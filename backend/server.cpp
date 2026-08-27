#include <iostream>
#include <string>
#include <sstream>
#include <ctime>
#include <algorithm>
#include <cctype>
#include <sqlite3.h>
#include <sodium.h>
#include <openssl/hmac.h>
#include <openssl/crypto.h>
#include "httplib.h"

using namespace std;

sqlite3* db;
string JWT_SECRET;
string HASH_DUMMY;
constexpr time_t JWT_TTL = 3600;

// ─── General utilities ─────────────────────────────────────────────────────

string getTimestamp() {
    time_t t = time(nullptr);
    char buf[20];
    strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S", localtime(&t));
    return string(buf);
}

// Extracts the value of a key from a simple JSON body.
// Matches "key":"value" or "key":value (numbers)
string extractField(const string& body, const string& key) {
    string search = "\"" + key + "\":";
    size_t pos = body.find(search);
    if (pos == string::npos) return "";
    pos += search.length();
    // skip whitespace
    while (pos < body.size() && body[pos] == ' ') pos++;
    if (body[pos] == '"') {
        size_t start = pos + 1;
        size_t end = body.find("\"", start);
        return body.substr(start, end - start);
    } else {
        size_t end = body.find_first_of(",}", pos);
        return body.substr(pos, end - pos);
    }
}

string extractErrorRate(const string& body) {
    string b = body;
    b.erase(remove_if(b.begin(), b.end(),
                      [](unsigned char c){ return isspace(c); }), b.end());

    string key = "\"error_rate\":";
    size_t start = b.find(key);
    if (start == string::npos) return "";      // no field -> return "" so the caller's stod() throws (400)
    start += key.length();
    if (start >= b.size()) return "";          // key sits at the very end of the body

    if (b[start] == '"') {                     // string form: "73.5"
        size_t end = b.find('"', start + 1);
        if (end == string::npos) return "";    // unclosed quote
        return b.substr(start + 1, end - start - 1);
    }
    size_t end = b.find_first_of(",}", start); // number form: 73.5
    return b.substr(start, end - start);
}

// ─── Base64 (needed for JWT) ─────────────────────────────────────────────
// JWT uses Base64URL — a variant that swaps + for - and / for _
// so the token is safe inside URLs and HTTP headers

string base64Encode(const string& input) {
    const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    string result;
    int val = 0, valb = -6;
    for (unsigned char c : input) {
        val = (val << 8) + c;
        valb += 8;
        while (valb >= 0) {
            result.push_back(chars[(val >> valb) & 0x3F]);
            valb -= 6;
        }
    }
    if (valb > -6) result.push_back(chars[((val << 8) >> (valb + 8)) & 0x3F]);
    while (result.size() % 4) result.push_back('=');
    // Convert to Base64URL
    for (char& c : result) {
        if (c == '+') c = '-';
        if (c == '/') c = '_';
    }
    // Strip = padding (Base64URL does not use it)
    while (!result.empty() && result.back() == '=') result.pop_back();
    return result;
}

string base64Decode(const string& input) {
    const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    string in = input;
    // Revert Base64URL back to standard Base64
    for (char& c : in) {
        if (c == '-') c = '+';
        if (c == '_') c = '/';
    }
    while (in.size() % 4) in.push_back('=');
    string result;
    int val = 0, valb = -8;
    for (unsigned char c : in) {
        if (c == '=') break;
        size_t p = chars.find(c);
        if (p == string::npos) break;
        val = (val << 6) + p;
        valb += 6;
        if (valb >= 0) {
            result.push_back((val >> valb) & 0xFF);
            valb -= 8;
        }
    }
    return result;
}

// ─── Cryptography ─────────────────────────────────────────────────────────────

// HMAC-SHA256: signs a message with a secret key.
// Used to sign the JWT — proves the token was not tampered with
string hmacSha256(const string& key, const string& data) {
    unsigned char* digest = HMAC(
        EVP_sha256(),
        key.c_str(), key.size(),
        (const unsigned char*)data.c_str(), data.size(),
        nullptr, nullptr
    );
    // Turn the digest bytes into a string so it can be fed into Base64
    return string((char*)digest, 32);
}

// Argon2id — replaces sha256() for passwords.
// The salt is random and travels inside the returned string.
string hashPassword(const string& password) {
    char buf[crypto_pwhash_STRBYTES];

    if (crypto_pwhash_str(buf,
                          password.c_str(), password.size(),
                          crypto_pwhash_OPSLIMIT_INTERACTIVE,
                          crypto_pwhash_MEMLIMIT_INTERACTIVE) != 0) {
        throw runtime_error("password hashing failed");
    }
    return string(buf);
}


// ─── JWT ─────────────────────────────────────────────────────────────────────
// Structure of a JWT: header.payload.signature
// Each part is Base64URL encoded
// Only the signature uses the secret key — header and payload are just Base64, not encrypted

string createJWT(const string& username, const string& role, const string& team) {
    // Fixed header — declares the algorithm
    string header = base64Encode("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");
    time_t exp = time(nullptr) + JWT_TTL;
    string expStr = to_string(exp);
    // Payload — user data (non-sensitive; visible once decoded)
    string payloadJson = "{\"username\":\"" + username + "\","
                         "\"role\":\"" + role + "\","
                         "\"team\":\"" + team + "\","
                         "\"exp\":" + expStr + "}";
    string payload = base64Encode(payloadJson);

    // Signature — HMAC-SHA256 of header.payload using the secret key
    string signature = base64Encode(hmacSha256(JWT_SECRET, header + "." + payload));

    return header + "." + payload + "." + signature;
}

// Verifies the token signature and extracts the payload.
// Returns the decoded payload, or "" if the token is invalid
string verifyJWT(const string& token) {
    // The token has the form: header.payload.signature
    size_t dot1 = token.find('.');
    size_t dot2 = token.find('.', dot1 + 1);
    if (dot1 == string::npos || dot2 == string::npos) return "";

    string headerPayload = token.substr(0, dot2);
    string signature     = token.substr(dot2 + 1);

    // Recompute the expected signature with our secret key
    string expectedSig = base64Encode(hmacSha256(JWT_SECRET, headerPayload));
    size_t signatureLen = signature.size();
    const char* signaturePointer = signature.data();
    const char* expectedPointer = expectedSig.data();
    
    if (signatureLen != expectedSig.size()) return "";

    // If the signature does not match, the token was tampered with or forged.
    // CRYPTO_memcmp compares in near-constant time so the check cannot be attacked by timing
    if (CRYPTO_memcmp(signaturePointer, expectedPointer, signatureLen)) return "";

    // Decode and return the payload
    string payload = token.substr(dot1 + 1, dot2 - dot1 - 1);
    string decodedPayload = base64Decode(payload);
    time_t exp;
    try{
        exp = stoll(extractField(decodedPayload, "exp")); 
    }
    catch(const std::exception&){
        return "";
    }
    if (time(nullptr) >= exp) return "";


    return decodedPayload;
}

// Extracts a field from the already-decoded payload.
// Example: getJWTField(payload, "role") → "manager"
string getJWTField(const string& payload, const string& field) {
    return extractField(payload, field);
}

// ─── Authentication middleware ──────────────────────────────────────────────
// Extracts the token from the Authorization: Bearer <token> header.
// Verifies the signature and returns the payload, or "" if invalid

string authenticate(const httplib::Request& req, httplib::Response& res) {
    // The header arrives as: Authorization: Bearer eyJhbG...
    string authHeader = req.get_header_value("Authorization");
    if (authHeader.empty() || authHeader.substr(0, 7) != "Bearer ") {
        res.status = 401;
        res.set_content("{\"error\":\"Missing token\"}", "application/json");
        return "";
    }
    string token = authHeader.substr(7); // drop "Bearer "
    string payload = verifyJWT(token);
    if (payload.empty()) {
        res.status = 401;
        res.set_content("{\"error\":\"Invalid token\"}", "application/json");
        return "";
    }
    return payload; // the caller pulls role/username/team out of the payload
}

// ─── Database ────────────────────────────────────────────────────────────

void initDB() {
    int rc = sqlite3_open("tickets.db", &db);
    if (rc != SQLITE_OK) {
        cerr << "Cannot open database: " << sqlite3_errmsg(db) << "\n";
        exit(1);
    }

    // tickets table — team and resolved_by were added later
    // The new columns are added via ALTER TABLE when the table already exists (migration)
    const char* ticketsSql = R"(
        CREATE TABLE IF NOT EXISTS tickets (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp       TEXT NOT NULL,
            priority        TEXT NOT NULL,
            error_rate      REAL NOT NULL,
            status          TEXT NOT NULL DEFAULT 'open',
            resolution_note TEXT,
            team            TEXT,
            resolved_by     TEXT
        );
    )";

    // users table — holds developers and the seeded manager account(s)
    // The manager is inserted at startup by seedManagers() from environment variables
    const char* usersSql = R"(
        CREATE TABLE IF NOT EXISTS users (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role     TEXT NOT NULL DEFAULT 'developer',
            team     TEXT
        );
    )";

    char* errMsg = nullptr;
    sqlite3_exec(db, ticketsSql, nullptr, nullptr, &errMsg);
    sqlite3_exec(db, usersSql,   nullptr, nullptr, &errMsg);

    // Migration: add the new tickets columns if they do not exist yet.
    // SQLite has no IF NOT EXISTS on ALTER TABLE, so we ignore the error
    sqlite3_exec(db, "ALTER TABLE tickets ADD COLUMN team TEXT;",        nullptr, nullptr, nullptr);
    sqlite3_exec(db, "ALTER TABLE tickets ADD COLUMN resolved_by TEXT;", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "ALTER TABLE tickets ADD COLUMN resolution_note TEXT;", nullptr, nullptr, nullptr);

    cout << "Database ready: tickets.db\n";
}

// Insert the manager account from environment variables if it does not exist yet.
// Called once at startup — managers are not created from the dashboard
void seedManagers() {
    string adminUsername;
    string adminPassword;
    const char* user = getenv("SEED_ADMIN_USER");
    if (!user) {
        cerr << "SEED_ADMIN_USER not set in environment\n";
        exit(1);
    }
    adminUsername = string(user);

    const char* secret = getenv("SEED_ADMIN_PASSWORD");
    if (!secret) {
        cerr << "SEED_ADMIN_PASSWORD not set in environment\n";
        exit(1);
    }
    adminPassword = string(secret);
    string hashed;
    try{
         hashed = hashPassword(adminPassword);
    }
    catch(const std::exception&){
        cerr << "Server error\n";
        exit(1);
    }
    
    sqlite3_stmt* stmt;
    const char* sql = "INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, 'manager');";
    sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr);
    // TRANSIENT: SQLite copies the bytes, so a bound local string's lifetime never matters
    sqlite3_bind_text(stmt, 1, adminUsername.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 2, hashed.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_step(stmt);
    sqlite3_finalize(stmt);
    
    cout << "Managers seeded\n";
}

// ─── JSON helpers ─────────────────────────────────────────────────────────────

string ticketToJson(int id, const string& timestamp, const string& priority,
                    double error_rate, const string& status,
                    const string& resolution_note, const string& team,
                    const string& resolved_by) {
    return "{"
        "\"id\":" + to_string(id) + ","
        "\"timestamp\":\"" + timestamp + "\","
        "\"priority\":\"" + priority + "\","
        "\"error_rate\":" + to_string(error_rate) + ","
        "\"status\":\"" + status + "\","
        "\"resolution_note\":\"" + resolution_note + "\","
        "\"team\":\"" + team + "\","
        "\"resolved_by\":\"" + resolved_by + "\""
    "}";
}

// ─── Main ─────────────────────────────────────────────────────────────────────

int main() {
    // Read JWT_SECRET from the environment
    const char* secret = getenv("JWT_SECRET");
    if (!secret) {
        cerr << "JWT_SECRET not set in environment\n";
        exit(1);
    }
    if (sodium_init() == -1){
        cerr << "Couldn't initialize sodium\n";
        exit(1);
    }
    JWT_SECRET = string(secret);
    try{
        HASH_DUMMY = hashPassword("00000000");
    }
    catch(const std::exception&){
        cerr << "Failed to generate dummy password\n";
        exit(1);
    }
    
    initDB();
    seedManagers();

    httplib::Server server;

    server.Options(".*", [](const httplib::Request&, httplib::Response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");
        res.set_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
        res.set_header("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.status = 204;
    });

    // POST /login — anyone may call this, no token required
    // Receives: { "username": "...", "password": "..." }
    // Returns:  { "token": "...", "role": "...", "team": "..." }
    server.Post("/login", [](const httplib::Request& req, httplib::Response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");

        string username = extractField(req.body, "username");
        string password = extractField(req.body, "password");

        if (username.empty() || password.empty()) {
            res.status = 400;
            res.set_content("{\"error\":\"Missing username or password\"}", "application/json");
            return;
        }

        sqlite3_stmt* stmt;
        const char* sql = "SELECT role, team, password FROM users WHERE username=?;";
        sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr);
        sqlite3_bind_text(stmt, 1, username.c_str(), -1, SQLITE_TRANSIENT);

        // User not found
        if (sqlite3_step(stmt) != SQLITE_ROW) {
            sqlite3_finalize(stmt);
            res.status = 401;
            // Verify against a dummy hash anyway, so a missing user costs the same
            // Argon2id time as a wrong password — otherwise the timing leaks which usernames exist
           [[maybe_unused]] int ignored = crypto_pwhash_str_verify(HASH_DUMMY.c_str(), password.c_str(), password.size());
            res.set_content("{\"error\":\"Invalid credentials\"}", "application/json");
            
            return;
        }

        string role = (const char*)sqlite3_column_text(stmt, 0);
        const unsigned char* teamPtr = sqlite3_column_text(stmt, 1);
        string team = teamPtr ? (const char*)teamPtr : "";
        string hashedPwd = (const char*)sqlite3_column_text(stmt, 2);
        sqlite3_finalize(stmt);

        // Wrong password — same status and message as the not-found case above
        if (crypto_pwhash_str_verify(hashedPwd.c_str(),
                                    password.c_str(), password.size()) != 0) {
            res.status = 401;
            res.set_content("{\"error\":\"Invalid credentials\"}", "application/json");
            return;
        }

        string token = createJWT(username, role, team);
        res.set_content(
            "{\"token\":\"" + token + "\","
            "\"role\":\"" + role + "\","
            "\"team\":\"" + team + "\","
            "\"username\":\"" + username + "\"}",
            "application/json"
        );
    });

    // POST /alert — Splunk notifies us (no token required — it comes from Splunk)
    server.Post("/alert", [](const httplib::Request& req, httplib::Response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");
        
        string error_rate_str = extractErrorRate(req.body);
        double error_rate = 0;
        try{
             error_rate = stod(error_rate_str);
        }
        catch (const std::exception&){
            res.status = 400;
            res.set_content("{\"error\": \"Invalid error rate: must be a number\"}", "application/json");
            return;
        }

        if (error_rate < 0 || error_rate > 100) {
            res.status = 400;
            res.set_content("{\"error\": \"error_rate out of range\"}", "application/json");
        return;
}
        
        string priority = (error_rate > 50) ? "P1" : "P2";
        string timestamp = getTimestamp();

        sqlite3_stmt* stmt;
        const char* sql = "INSERT INTO tickets (timestamp, priority, error_rate, status) "
                          "VALUES (?, ?, ?, 'open');";
        sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr);
        sqlite3_bind_text(stmt, 1, timestamp.c_str(), -1, SQLITE_TRANSIENT);
        sqlite3_bind_text(stmt, 2, priority.c_str(), -1, SQLITE_TRANSIENT);
        sqlite3_bind_double(stmt, 3, error_rate);
        sqlite3_step(stmt);
        sqlite3_finalize(stmt);

        int id = (int)sqlite3_last_insert_rowid(db);
        cout << "Ticket created: INC-00" << id << " at " << timestamp << "\n";
        res.set_content(ticketToJson(id, timestamp, priority, error_rate, "open", "", "", ""), "application/json");
    });

    // GET /tickets — requires token
    // Manager sees all; developer sees only their team's
    server.Get("/tickets", [](const httplib::Request& req, httplib::Response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");

        string payload = authenticate(req, res);
        if (payload.empty()) return; // authenticate already sent the 401

        string role = getJWTField(payload, "role");
        string team = getJWTField(payload, "team");

        sqlite3_stmt* stmt;
        string sql;

        if (role == "manager") {
            // Manager sees every ticket
            sql = "SELECT id, timestamp, priority, error_rate, status, "
                  "COALESCE(resolution_note,''), COALESCE(team,''), COALESCE(resolved_by,'') "
                  "FROM tickets ORDER BY id DESC;";
            sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, nullptr);
        } else {
            // Developer sees only their team's tickets
            sql = "SELECT id, timestamp, priority, error_rate, status, "
                  "COALESCE(resolution_note,''), COALESCE(team,''), COALESCE(resolved_by,'') "
                  "FROM tickets WHERE team=? ORDER BY id DESC;";
            sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, nullptr);
            sqlite3_bind_text(stmt, 1, team.c_str(), -1, SQLITE_TRANSIENT);
        }

        string json = "[";
        bool first = true;
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            if (!first) json += ",";
            first = false;
            json += ticketToJson(
                sqlite3_column_int(stmt, 0),
                (const char*)sqlite3_column_text(stmt, 1),
                (const char*)sqlite3_column_text(stmt, 2),
                sqlite3_column_double(stmt, 3),
                (const char*)sqlite3_column_text(stmt, 4),
                (const char*)sqlite3_column_text(stmt, 5),
                (const char*)sqlite3_column_text(stmt, 6),
                (const char*)sqlite3_column_text(stmt, 7)
            );
        }
        json += "]";
        sqlite3_finalize(stmt);
        res.set_content(json, "application/json");
    });

    // PUT /tickets/:id — requires token (manager or developer)
    // Stores resolved_by with the username from the token
    server.Put("/tickets/(\\d+)", [](const httplib::Request& req, httplib::Response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");

        string payload = authenticate(req, res);
        if (payload.empty()) return;

        string username = getJWTField(payload, "username");
        int id = stoi(req.matches[1]);

        string resolution_note = extractField(req.body, "resolution_note");

        sqlite3_stmt* stmt;
        const char* sql = "UPDATE tickets SET status='resolved', resolution_note=?, resolved_by=? WHERE id=?;";
        sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr);
        sqlite3_bind_text(stmt, 1, resolution_note.c_str(), -1, SQLITE_TRANSIENT);
        sqlite3_bind_text(stmt, 2, username.c_str(), -1, SQLITE_TRANSIENT);
        sqlite3_bind_int(stmt, 3, id);
        sqlite3_step(stmt);
        sqlite3_finalize(stmt);

        if (sqlite3_changes(db) == 0) {
            res.status = 404;
            return;
        }

        sqlite3_stmt* sel;
        const char* selSql = "SELECT id, timestamp, priority, error_rate, status, "
                             "COALESCE(resolution_note,''), COALESCE(team,''), COALESCE(resolved_by,'') "
                             "FROM tickets WHERE id=?;";
        sqlite3_prepare_v2(db, selSql, -1, &sel, nullptr);
        sqlite3_bind_int(sel, 1, id);
        sqlite3_step(sel);
        string json = ticketToJson(
            sqlite3_column_int(sel, 0),
            (const char*)sqlite3_column_text(sel, 1),
            (const char*)sqlite3_column_text(sel, 2),
            sqlite3_column_double(sel, 3),
            (const char*)sqlite3_column_text(sel, 4),
            (const char*)sqlite3_column_text(sel, 5),
            (const char*)sqlite3_column_text(sel, 6),
            (const char*)sqlite3_column_text(sel, 7)
        );
        sqlite3_finalize(sel);
        res.set_content(json, "application/json");
    });


    // POST /users — manager creates a developer
    // Receives: { "username": "...", "password": "...", "team": "..." }
    server.Post("/users", [](const httplib::Request& req, httplib::Response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");

        string payload = authenticate(req, res);
        if (payload.empty()) return;

        // Only managers may create users
        if (getJWTField(payload, "role") != "manager") {
            res.status = 403;
            res.set_content("{\"error\":\"Forbidden\"}", "application/json");
            return;
        }

        string username = extractField(req.body, "username");
        string password = extractField(req.body, "password");
        string team     = extractField(req.body, "team");

        if (username.empty() || password.empty()) {
            res.status = 400;
            res.set_content("{\"error\":\"Missing username or password\"}", "application/json");
            return;
        }
        string hashed;
        try{
            hashed = hashPassword(password);
        }
        catch(const std::exception&){
            res.status = 500;
            res.set_content("{\"error\":\"Server error\"}", "application/json");
            return;
        }
        

        sqlite3_stmt* stmt;
        const char* sql = "INSERT INTO users (username, password, role, team) VALUES (?, ?, 'developer', ?);";
        sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr);
        sqlite3_bind_text(stmt, 1, username.c_str(), -1, SQLITE_TRANSIENT);
        sqlite3_bind_text(stmt, 2, hashed.c_str(),   -1, SQLITE_TRANSIENT);
        sqlite3_bind_text(stmt, 3, team.c_str(),     -1, SQLITE_TRANSIENT);
        int rc = sqlite3_step(stmt);
        sqlite3_finalize(stmt);

        // SQLITE_CONSTRAINT means the username already exists (UNIQUE)
        if (rc == SQLITE_CONSTRAINT) {
            res.status = 409;
            res.set_content("{\"error\":\"Username already exists\"}", "application/json");
            return;
        }

        int id = (int)sqlite3_last_insert_rowid(db);
        cout << "Developer created: " << username << " (team: " << team << ")\n";
        res.set_content(
            "{\"id\":" + to_string(id) + ","
            "\"username\":\"" + username + "\","
            "\"role\":\"developer\","
            "\"team\":\"" + team + "\"}",
            "application/json"
        );
    });

    // GET /users — manager lists every developer
    server.Get("/users", [](const httplib::Request& req, httplib::Response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");

        string payload = authenticate(req, res);
        if (payload.empty()) return;

        if (getJWTField(payload, "role") != "manager") {
            res.status = 403;
            res.set_content("{\"error\":\"Forbidden\"}", "application/json");
            return;
        }

        sqlite3_stmt* stmt;
        const char* sql = "SELECT id, username, role, COALESCE(team,'') FROM users WHERE role='developer' ORDER BY id ASC;";
        sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr);

        string json = "[";
        bool first = true;
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            if (!first) json += ",";
            first = false;
            int id          = sqlite3_column_int(stmt, 0);
            string username = (const char*)sqlite3_column_text(stmt, 1);
            string role     = (const char*)sqlite3_column_text(stmt, 2);
            string team     = (const char*)sqlite3_column_text(stmt, 3);
            json += "{\"id\":" + to_string(id) + ","
                    "\"username\":\"" + username + "\","
                    "\"role\":\"" + role + "\","
                    "\"team\":\"" + team + "\"}";
        }
        json += "]";
        sqlite3_finalize(stmt);

        res.set_content(json, "application/json");
    });

    // PUT /users/:id/team — manager changes a developer's team
    // Receives: { "team": "..." }
    server.Put("/users/(\\d+)/team", [](const httplib::Request& req, httplib::Response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");

        string payload = authenticate(req, res);
        if (payload.empty()) return;

        if (getJWTField(payload, "role") != "manager") {
            res.status = 403;
            res.set_content("{\"error\":\"Forbidden\"}", "application/json");
            return;
        }

        int id      = stoi(req.matches[1]);
        string team = extractField(req.body, "team");

        sqlite3_stmt* stmt;
        const char* sql = "UPDATE users SET team=? WHERE id=? AND role='developer';";
        sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr);
        sqlite3_bind_text(stmt, 1, team.c_str(), -1, SQLITE_TRANSIENT);
        sqlite3_bind_int(stmt, 2, id);
        sqlite3_step(stmt);
        sqlite3_finalize(stmt);

        if (sqlite3_changes(db) == 0) {
            res.status = 404;
            res.set_content("{\"error\":\"Developer not found\"}", "application/json");
            return;
        }

        cout << "Developer #" << id << " assigned to team: " << team << "\n";
        res.set_content(
            "{\"id\":" + to_string(id) + ","
            "\"team\":\"" + team + "\"}",
            "application/json"
        );
    });


    // PUT /tickets/:id/assign — manager assigns a ticket to a team
    // Receives: { "team": "..." }
    server.Put("/tickets/(\\d+)/assign", [](const httplib::Request& req, httplib::Response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");

        string payload = authenticate(req, res);
        if (payload.empty()) return;

        if (getJWTField(payload, "role") != "manager") {
            res.status = 403;
            res.set_content("{\"error\":\"Forbidden\"}", "application/json");
            return;
        }

        int id      = stoi(req.matches[1]);
        string team = extractField(req.body, "team");

        if (team.empty()) {
            res.status = 400;
            res.set_content("{\"error\":\"Missing team\"}", "application/json");
            return;
        }

        sqlite3_stmt* stmt;
        const char* sql = "UPDATE tickets SET team=? WHERE id=?;";
        sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr);
        sqlite3_bind_text(stmt, 1, team.c_str(), -1, SQLITE_TRANSIENT);
        sqlite3_bind_int(stmt, 2, id);
        sqlite3_step(stmt);
        sqlite3_finalize(stmt);

        if (sqlite3_changes(db) == 0) {
            res.status = 404;
            res.set_content("{\"error\":\"Ticket not found\"}", "application/json");
            return;
        }

        cout << "Ticket #" << id << " assigned to team: " << team << "\n";
        res.set_content(
            "{\"id\":" + to_string(id) + ","
            "\"team\":\"" + team + "\"}",
            "application/json"
        );
    });

    cout << "Server running on port 8080\n";
    server.listen("0.0.0.0", 8080);
    return 0;
}