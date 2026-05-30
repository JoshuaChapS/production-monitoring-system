#include <iostream>
#include <string>
#include <sstream>
#include <ctime>
#include <sqlite3.h>
#include "httplib.h"

using namespace std;

sqlite3* db;

string getTimestamp() {
    time_t t = time(nullptr);
    char buf[20];
    strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S", localtime(&t));
    return string(buf);
}

string extractErrorRate(const string& body) {
    string key = "\"error_rate\": \"";
    size_t start = body.find(key);
    if (start == string::npos) return "0.0";
    start += key.length();
    size_t end = body.find("\"", start);
    return body.substr(start, end - start);
}

void initDB() {
    int rc = sqlite3_open("tickets.db", &db);
    if (rc != SQLITE_OK) {
        cerr << "Cannot open database: " << sqlite3_errmsg(db) << "\n";
        exit(1);
    }
    const char* sql = R"(
        CREATE TABLE IF NOT EXISTS tickets (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp  TEXT NOT NULL,
            priority   TEXT NOT NULL,
            error_rate REAL NOT NULL,
            status     TEXT NOT NULL DEFAULT 'open'
        );
    )";
    char* errMsg = nullptr;
    rc = sqlite3_exec(db, sql, nullptr, nullptr, &errMsg);
    if (rc != SQLITE_OK) {
        cerr << "SQL error: " << errMsg << "\n";
        sqlite3_free(errMsg);
        exit(1);
    }
    cout << "Database ready: tickets.db\n";
}

string rowToJson(int id, const string& timestamp, const string& priority,
                 double error_rate, const string& status) {
    return "{"
        "\"id\":" + to_string(id) + ","
        "\"timestamp\":\"" + timestamp + "\","
        "\"priority\":\"" + priority + "\","
        "\"error_rate\":" + to_string(error_rate) + ","
        "\"status\":\"" + status + "\""
    "}";
}

int main() {
    initDB();

    httplib::Server server;

    server.Options(".*", [](const httplib::Request& req, httplib::Response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");
        res.set_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
        res.set_header("Access-Control-Allow-Headers", "Content-Type");
        res.status = 204;
    });

    // POST /alert — Splunk nos avisa
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
        res.set_content(rowToJson(id, timestamp, priority, error_rate, "open"), "application/json");
    });

    // GET /tickets — React pide todos los tickets
    server.Get("/tickets", [](const httplib::Request& req, httplib::Response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");

        sqlite3_stmt* stmt;
        const char* sql = "SELECT id, timestamp, priority, error_rate, status FROM tickets ORDER BY id DESC;";
        sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr);

        string json = "[";
        bool first = true;
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            if (!first) json += ",";
            first = false;
            int id            = sqlite3_column_int(stmt, 0);
            string timestamp  = (const char*)sqlite3_column_text(stmt, 1);
            string priority   = (const char*)sqlite3_column_text(stmt, 2);
            double error_rate = sqlite3_column_double(stmt, 3);
            string status     = (const char*)sqlite3_column_text(stmt, 4);
            json += rowToJson(id, timestamp, priority, error_rate, status);
        }
        json += "]";
        sqlite3_finalize(stmt);

        res.set_content(json, "application/json");
    });

    // PUT /tickets/:id — React resuelve un ticket
    server.Put("/tickets/(\\d+)", [](const httplib::Request& req, httplib::Response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");

        int id = stoi(req.matches[1]);

        sqlite3_stmt* stmt;
        const char* sql = "UPDATE tickets SET status='resolved' WHERE id=?;";
        sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr);
        sqlite3_bind_int(stmt, 1, id);
        sqlite3_step(stmt);
        sqlite3_finalize(stmt);

        if (sqlite3_changes(db) == 0) {
            res.status = 404;
            return;
        }

        // Regresar el ticket actualizado
        sqlite3_stmt* sel;
        const char* selSql = "SELECT id, timestamp, priority, error_rate, status FROM tickets WHERE id=?;";
        sqlite3_prepare_v2(db, selSql, -1, &sel, nullptr);
        sqlite3_bind_int(sel, 1, id);
        sqlite3_step(sel);
        string json = rowToJson(
            sqlite3_column_int(sel, 0),
            (const char*)sqlite3_column_text(sel, 1),
            (const char*)sqlite3_column_text(sel, 2),
            sqlite3_column_double(sel, 3),
            (const char*)sqlite3_column_text(sel, 4)
        );
        sqlite3_finalize(sel);

        res.set_content(json, "application/json");
    });

    cout << "Server running on port 8080\n";
    server.listen("0.0.0.0", 8080);
    return 0;
}