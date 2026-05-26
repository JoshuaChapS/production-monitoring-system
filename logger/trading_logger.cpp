#include <iostream>
#include <fstream>
#include <string>
#include <vector>
#include <cstdlib>
#include <ctime>
#include <chrono>
#include <thread>

using namespace std;
using namespace std::chrono;

string getTimestamp() {
    auto now = system_clock::now();
    time_t t = system_clock::to_time_t(now);
    char buf[20];
    strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S", localtime(&t));
    return string(buf);
}

int main() {
    const char* logPath = getenv("LOG_PATH");
    if (!logPath) {
        cerr << "ERROR: LOG_PATH not set\n";
        return 1;
    }
    
    ofstream logFile(logPath, ios::trunc);
    if (!logFile.is_open()) {
        cerr << "ERROR: Cannot open log file at " << logPath << "\n";
        return 1;
    }
    

    vector<string> errors  = {"DB_TIMEOUT", "AUTH_FAILED", "NULL_POINTER", "CONNECTION_REFUSED"};
    vector<string> levels  = {"INFO", "INFO", "INFO", "WARNING", "ERROR"};
    vector<int>    users   = {1001, 1002, 1003, 1004, 1005};
    vector<string> actions = {"GET_BALANCE", "EXECUTE_TRADE", "LOGIN", "LOGOUT", "GET_REPORT"};

    srand(time(nullptr));

    bool incident = false;
    int counter = 180;

    while (true) {
        counter++;
        if (counter == 200) incident = true;   // incidente a los 100 seg
        if (counter == 240) {                  // dura 20 seg
            incident = false;
            counter = 0;
        }
        string level;
        if (incident) {
            // Durante el incidente 80% errores
            level = (rand() % 10 < 8) ? "ERROR" : "WARNING";
        } else {
            level = levels[rand() % levels.size()];
        }

        int    user   = users[rand() % users.size()];
        string action = actions[rand() % actions.size()];

        if (level == "ERROR") {
            string error = errors[rand() % errors.size()];
            logFile << getTimestamp() << " level=" << level 
                    << " status=failed user_id=" << user
                    << " action=" << action
                    << " error=" << error << "\n";
        } else {
            logFile << getTimestamp() << " level=" << level 
                    << " status=success user_id=" << user
                    << " action=" << action
                    << " latency_ms=" << (rand() % 200 + 10) << "\n";
        }

        logFile.flush();
        this_thread::sleep_for(milliseconds(500));
    }

    return 0;
}