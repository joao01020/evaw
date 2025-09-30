#pragma once
#include <string>
#include <ctime>

struct Block {
    int index;
    std::string previousHash;
    std::string timestamp;
    std::string data;
    std::string hash;
};
