#include <iostream>
#include <string>
#include <sstream>
#include <ctime>
#include <sqlite3.h>
#include <openssl/sha.h>
#include <openssl/hmac.h>
#include "httplib.h"

using namespace std;

sqlite3* db;
string JWT_SECRET;

// ─── Utilidades generales ─────────────────────────────────────────────────────

string getTimestamp() {
    time_t t = time(nullptr);
    char buf[20];
    strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S", localtime(&t));
    return string(buf);
}

// Extrae el valor de una clave en un JSON simple
// Busca "key":"valor" o "key":valor (números)
string extractField(const string& body, const string& key) {
    string search = "\"" + key + "\":";
    size_t pos = body.find(search);
    if (pos == string::npos) return "";
    pos += search.length();
    // saltar espacios
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
    string key = "\"error_rate\": \"";
    size_t start = body.find(key);
    if (start == string::npos) return "0.0";
    start += key.length();
    size_t end = body.find("\"", start);
    return body.substr(start, end - start);
}

// ─── Base64 (necesario para JWT) ─────────────────────────────────────────────
// JWT usa Base64URL — variante que reemplaza + por - y / por _
// para que el token sea seguro en URLs y headers HTTP

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
    // Convertir a Base64URL
    for (char& c : result) {
        if (c == '+') c = '-';
        if (c == '/') c = '_';
    }
    // Quitar padding = (Base64URL no lo usa)
    while (!result.empty() && result.back() == '=') result.pop_back();
    return result;
}

string base64Decode(const string& input) {
    const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    string in = input;
    // Revertir Base64URL a Base64 normal
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

// ─── Criptografía ─────────────────────────────────────────────────────────────

// SHA-256: convierte un string a su hash hexadecimal
// Usado para guardar passwords — nunca guardamos el password en texto plano
string sha256(const string& input) {
    unsigned char hash[SHA256_DIGEST_LENGTH]; // array de 32 bytes
    SHA256((const unsigned char*)input.c_str(), input.size(), hash);
    // Convertir bytes a string hexadecimal (ej: "a3f2...")
    ostringstream oss;
    for (int i = 0; i < SHA256_DIGEST_LENGTH; i++)
        oss << hex << setw(2) << setfill('0') << (int)hash[i];
    return oss.str();
}

// HMAC-SHA256: firma un mensaje con una clave secreta
// Usado para firmar el JWT — verifica que el token no fue modificado
string hmacSha256(const string& key, const string& data) {
    unsigned char* digest = HMAC(
        EVP_sha256(),
        key.c_str(), key.size(),
        (const unsigned char*)data.c_str(), data.size(),
        nullptr, nullptr
    );
    // Convertir los bytes del digest a string para poder meterlo en Base64
    return string((char*)digest, 32);
}

// ─── JWT ─────────────────────────────────────────────────────────────────────
// Estructura de un JWT: header.payload.signature
// Cada parte es Base64URL encoded
// Solo la firma usa la secret key — header y payload son solo Base64, no encriptados

string createJWT(const string& username, const string& role, const string& team) {
    // Header fijo — indica el algoritmo
    string header = base64Encode("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");

    // Payload — datos del usuario (no sensibles, son visibles al decodificar)
    string payloadJson = "{\"username\":\"" + username + "\","
                         "\"role\":\"" + role + "\","
                         "\"team\":\"" + team + "\"}";
    string payload = base64Encode(payloadJson);

    // Firma — HMAC-SHA256 del header.payload con la secret key
    string signature = base64Encode(hmacSha256(JWT_SECRET, header + "." + payload));

    return header + "." + payload + "." + signature;
}

// Verifica la firma del token y extrae el payload
// Regresa el payload decodificado, o "" si el token es inválido
string verifyJWT(const string& token) {
    // El token tiene formato: header.payload.signature
    size_t dot1 = token.find('.');
    size_t dot2 = token.find('.', dot1 + 1);
    if (dot1 == string::npos || dot2 == string::npos) return "";

    string headerPayload = token.substr(0, dot2);
    string signature     = token.substr(dot2 + 1);

    // Recalcular la firma esperada con nuestra secret key
    string expectedSig = base64Encode(hmacSha256(JWT_SECRET, headerPayload));

    // Si la firma no coincide, el token fue modificado o es falso
    if (signature != expectedSig) return "";

    // Decodificar y regresar el payload
    string payload = token.substr(dot1 + 1, dot2 - dot1 - 1);
    return base64Decode(payload);
}

// Extrae un campo del payload ya decodificado
// Ejemplo: getJWTField(payload, "role") → "manager"
string getJWTField(const string& payload, const string& field) {
    return extractField(payload, field);
}

// ─── Middleware de autenticación ──────────────────────────────────────────────
// Extrae el token del header Authorization: Bearer <token>
// Verifica la firma y regresa el payload, o "" si no es válido

string authenticate(const httplib::Request& req, httplib::Response& res) {
    // El header se manda como: Authorization: Bearer eyJhbG...
    string authHeader = req.get_header_value("Authorization");
    if (authHeader.empty() || authHeader.substr(0, 7) != "Bearer ") {
        res.status = 401;
        res.set_content("{\"error\":\"Missing token\"}", "application/json");
        return "";
    }
    string token = authHeader.substr(7); // quitar "Bearer "
    string payload = verifyJWT(token);
    if (payload.empty()) {
        res.status = 401;
        res.set_content("{\"error\":\"Invalid token\"}", "application/json");
        return "";
    }
    return payload; // el caller extrae role/username/team del payload
}

// ─── Base de datos ────────────────────────────────────────────────────────────

void initDB() {
    int rc = sqlite3_open("tickets.db", &db);
    if (rc != SQLITE_OK) {
        cerr << "Cannot open database: " << sqlite3_errmsg(db) << "\n";
        exit(1);
    }

    // Tabla tickets — agregamos team, resolved_by
    // Las columnas nuevas usan ALTER TABLE si la tabla ya existe (migración)
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

    // Tabla users — solo developers viven aquí
    // Los managers están hardcodeados en el código
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

    // Migración: agregar columnas nuevas a tickets si no existen
    // SQLite no tiene IF NOT EXISTS en ALTER TABLE, así que ignoramos el error
    sqlite3_exec(db, "ALTER TABLE tickets ADD COLUMN team TEXT;",        nullptr, nullptr, nullptr);
    sqlite3_exec(db, "ALTER TABLE tickets ADD COLUMN resolved_by TEXT;", nullptr, nullptr, nullptr);
    sqlite3_exec(db, "ALTER TABLE tickets ADD COLUMN resolution_note TEXT;", nullptr, nullptr, nullptr);

    cout << "Database ready: tickets.db\n";
}

// Insertar managers hardcodeados si no existen
// Se llama una vez al arrancar — los managers no se crean desde el dashboard
void seedManagers() {
    vector<pair<string,string>> managers = {
        {"joshua", "jpm2026"},
        {"humberto", "jpm2026"}
    };

    for (auto& [username, password] : managers) {
        string hashed = sha256(password);
        cout << "Seeding " << username << " with hash: " << hashed << "\n";
        sqlite3_stmt* stmt;
        const char* sql = "INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, 'manager');";
        sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr);
        sqlite3_bind_text(stmt, 1, username.c_str(), -1, SQLITE_TRANSIENT);
        sqlite3_bind_text(stmt, 2, hashed.c_str(), -1, SQLITE_TRANSIENT);
        sqlite3_step(stmt);
        sqlite3_finalize(stmt);
    }
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
    // Leer JWT_SECRET del entorno
    const char* secret = getenv("JWT_SECRET");
    if (!secret) {
        cerr << "JWT_SECRET not set in environment\n";
        exit(1);
    }
    JWT_SECRET = string(secret);

    initDB();
    seedManagers();

    httplib::Server server;

    server.Options(".*", [](const httplib::Request&, httplib::Response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");
        res.set_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
        res.set_header("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.status = 204;
    });

    // POST /login — cualquiera puede llamar esto, no requiere token
    // Recibe: { "username": "...", "password": "..." }
    // Regresa: { "token": "...", "role": "...", "team": "..." }
    server.Post("/login", [](const httplib::Request& req, httplib::Response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");

        string username = extractField(req.body, "username");
        string password = extractField(req.body, "password");

        if (username.empty() || password.empty()) {
            res.status = 400;
            res.set_content("{\"error\":\"Missing username or password\"}", "application/json");
            return;
        }

        // Buscar usuario en la BD comparando el hash del password
        sqlite3_stmt* stmt;
        const char* sql = "SELECT role, team FROM users WHERE username=? AND password=?;";
        sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr);
        sqlite3_bind_text(stmt, 1, username.c_str(), -1, SQLITE_STATIC);
        string hashedPwd = sha256(password);
        sqlite3_bind_text(stmt, 2, hashedPwd.c_str(), -1, SQLITE_STATIC);

        if (sqlite3_step(stmt) == SQLITE_ROW) {
            string role = (const char*)sqlite3_column_text(stmt, 0);
            const unsigned char* teamPtr = sqlite3_column_text(stmt, 1);
            string team = teamPtr ? (const char*)teamPtr : "";
            sqlite3_finalize(stmt);

            string token = createJWT(username, role, team);
            res.set_content(
                "{\"token\":\"" + token + "\","
                "\"role\":\"" + role + "\","
                "\"team\":\"" + team + "\","
                "\"username\":\"" + username + "\"}",
                "application/json"
            );
        } else {
            sqlite3_finalize(stmt);
            res.status = 401;
            res.set_content("{\"error\":\"Invalid credentials\"}", "application/json");
        }
    });

    // POST /alert — Splunk nos avisa (no requiere token — viene de Splunk)
    server.Post("/alert", [](const httplib::Request& req, httplib::Response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");

        string error_rate_str = extractErrorRate(req.body);
        double error_rate = stod(error_rate_str);
        string priority = (error_rate > 50) ? "P1" : "P2";
        string timestamp = getTimestamp();

        sqlite3_stmt* stmt;
        const char* sql = "INSERT INTO tickets (timestamp, priority, error_rate, status) "
                          "VALUES (?, ?, ?, 'open');";
        sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr);
        sqlite3_bind_text(stmt, 1, timestamp.c_str(), -1, SQLITE_STATIC);
        sqlite3_bind_text(stmt, 2, priority.c_str(), -1, SQLITE_STATIC);
        sqlite3_bind_double(stmt, 3, error_rate);
        sqlite3_step(stmt);
        sqlite3_finalize(stmt);

        int id = (int)sqlite3_last_insert_rowid(db);
        cout << "Ticket created: INC-00" << id << " at " << timestamp << "\n";
        res.set_content(ticketToJson(id, timestamp, priority, error_rate, "open", "", "", ""), "application/json");
    });

    // GET /tickets — requiere token
    // Manager ve todos, developer ve solo los de su equipo
    server.Get("/tickets", [](const httplib::Request& req, httplib::Response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");

        string payload = authenticate(req, res);
        if (payload.empty()) return; // authenticate ya mandó el 401

        string role = getJWTField(payload, "role");
        string team = getJWTField(payload, "team");

        sqlite3_stmt* stmt;
        string sql;

        if (role == "manager") {
            // Manager ve todos los tickets
            sql = "SELECT id, timestamp, priority, error_rate, status, "
                  "COALESCE(resolution_note,''), COALESCE(team,''), COALESCE(resolved_by,'') "
                  "FROM tickets ORDER BY id DESC;";
            sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, nullptr);
        } else {
            // Developer ve solo los tickets de su equipo
            sql = "SELECT id, timestamp, priority, error_rate, status, "
                  "COALESCE(resolution_note,''), COALESCE(team,''), COALESCE(resolved_by,'') "
                  "FROM tickets WHERE team=? ORDER BY id DESC;";
            sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, nullptr);
            sqlite3_bind_text(stmt, 1, team.c_str(), -1, SQLITE_STATIC);
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

    // PUT /tickets/:id — requiere token (manager o developer)
    // Guarda resolved_by con el username del token
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
        sqlite3_bind_text(stmt, 1, resolution_note.c_str(), -1, SQLITE_STATIC);
        sqlite3_bind_text(stmt, 2, username.c_str(), -1, SQLITE_STATIC);
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

    cout << "Server running on port 8080\n";
    server.listen("0.0.0.0", 8080);
    return 0;
}