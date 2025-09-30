#pragma once
#include "block.h"
#include <vector>

class Blockchain {
public:
    Blockchain();
    void addBlock(const std::string &data);
    bool isValid();
    std::vector<Block> getChain();
private:
    std::vector<Block> chain;
    Block createGenesisBlock();
    std::string calculateHash(const Block &block);
};
