#include "blockchain.h"
#include <sstream>
#include <iostream>
#include <iomanip> Precisa instalar OpenSSL para hash

Blockchain::Blockchain() {
    chain.push_back(createGenesisBlock());
}

Block Blockchain::createGenesisBlock() {
    Block genesis;
    genesis.index = 0;
    genesis.previousHash = "0";
    genesis.timestamp = std::to_string(time(0));
    genesis.data = "Genesis Block";
    genesis.hash = calculateHash(genesis);
    return genesis;


}

bool Blockchain::isValid() {
    for(size_t i=1;i<chain.size();i++){
        if(chain[i].previousHash != chain[i-1].hash)
            return false;
        if(chain[i].hash != calculateHash(chain[i]))
            return false;
    }
    return true;
}

std::vector<Block> Blockchain::getChain() {
    return chain;
}
