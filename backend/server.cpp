#include <iostream>
#include <vector>
#include <string>
#include <ctime>
#include "httplib.h"

using namespace std;

struct Ticket {
    int    id;
    string timestamp;
    string priority;
    double error_rate;
    string status;
};

vector<Ticket> tickets;
int nextId = 1;

string getTimestamp() {
    time_t t = time(nullptr);
    char buf[20];
    strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S", localtime(&t));
    return string(buf);
}

string ticketToJson(const Ticket& t) {
    return "{"
        "\"id\":" + to_string(t.id) + ","
        "\"timestamp\":\"" + t.timestamp + "\","
        "\"priority\":\"" + t.priority + "\","
        "\"error_rate\":" + to_string(t.error_rate) + ","
        "\"status\":\"" + t.status + "\""
    "}";
}

string extractErrorRate(const string& body) {
    string key = "\"error_rate\": \"";
    size_t start = body.find(key);
    if (start == string::npos) return "0.0";
    
    start += key.length();
    size_t end = body.find("\"", start);
    return body.substr(start, end - start);
}

int main() {
    httplib::Server server;

    // POST /alert — Splunk nos avisa
    server.Post("/alert", [](const httplib::Request& req, httplib::Response& res) {
        
        Ticket t;
        t.id         = nextId++;
        t.timestamp  = getTimestamp();
        string error_rate_str = extractErrorRate(req.body);
        t.error_rate = stod(error_rate_str);
        t.priority   = (t.error_rate > 50) ? "P1" : "P2";
        t.status     = "open";
        tickets.push_back(t);

        cout << "Ticket created: INC-00" << t.id << " at " << t.timestamp << "\n";
        res.set_content(ticketToJson(t), "application/json");
    });

    // GET /tickets — React pide todos los tickets
    server.Get("/tickets", [](const httplib::Request& req, httplib::Response& res) {
        string json = "[";
        for (int i = 0; i < tickets.size(); i++) {
            json += ticketToJson(tickets[i]);
            if (i < tickets.size() - 1) json += ",";
        }
        json += "]";
        res.set_content(json, "application/json");
    });

    // PUT /tickets/:id — React resuelve un ticket
    server.Put("/tickets/(\\d+)", [](const httplib::Request& req, httplib::Response& res) {
        int id = stoi(req.matches[1]);
        for (auto& t : tickets) {
            if (t.id == id) {
                t.status = "resolved";
                res.set_content(ticketToJson(t), "application/json");
                return;
            }
        }
        res.status = 404;
    });

    cout << "Server running on port 8080\n";
    server.listen("0.0.0.0", 8080);
    return 0;
}