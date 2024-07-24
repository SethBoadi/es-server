const express = require('express');
const bodyParser = require('body-parser');
const ethers = require('ethers');
const axios = require('axios');
const app = express();
app.use(bodyParser.json());

const ESD_PLATFORM_ETH_ADDRESS = '0xF0A8965eaE48C7ec690cD6c3c6DcC2e160Ef41c2';
const ETHERSCAN_API_KEY = '311UGV1I13TYUS69ZF5N2AEMCDJQGXJUTR';
const KRAKEN_API_URL = 'https://api.kraken.com/0/public/Ticker?pair=ETHUSD';

let users = {}; // In-memory user data, replace with a database in production

app.post('/register', async (req, res) => {
    const { ethAddress, password } = req.body;
    if (!ethAddress || !password) {
        return res.status(400).send('Ethereum address and password are required.');
    }
    if (users[ethAddress]) {
        return res.status(400).send('User already exists.');
    }
    users[ethAddress] = { password, balance: 0, cashback: 0 };
    res.send('Registration successful.');
});

app.post('/buy', async (req, res) => {
    const { ethAddress, txHash } = req.body;
    if (!ethAddress || !txHash) {
        return res.status(400).send('Ethereum address and transaction hash are required.');
    }
    if (!users[ethAddress]) {
        return res.status(400).send('User not registered.');
    }
    
    try {
        const txData = await axios.get(`https://api.etherscan.io/api?module=transaction&action=gettxreceiptstatus&txhash=${txHash}&apikey=${ETHERSCAN_API_KEY}`);
        if (txData.data.result.status !== "1") {
            return res.status(400).send('Transaction failed.');
        }
        
        const txDetails = await axios.get(`https://api.etherscan.io/api?module=transaction&action=gettxinfo&txhash=${txHash}&apikey=${ETHERSCAN_API_KEY}`);
        const ethValue = ethers.utils.formatEther(txDetails.data.result.value);
        
        const priceData = await axios.get(KRAKEN_API_URL);
        const ethPrice = parseFloat(priceData.data.result.XETHZUSD.c[0]);
        const usdValue = ethValue * ethPrice * 3.33;
        
        users[ethAddress].balance += usdValue;
        users[ethAddress].cashback += usdValue * 0.33;
        res.send(`Purchase successful. Your new balance is ${users[ethAddress].balance} ESD.`);
    } catch (error) {
        res.status(500).send('Error processing transaction.');
    }
});

app.post('/send', async (req, res) => {
    const { sender, receiver, amount, password } = req.body;
    if (!sender || !receiver || !amount || !password) {
        return res.status(400).send('All fields are required.');
    }
    if (!users[sender] || users[sender].password !== password) {
        return res.status(400).send('Invalid sender credentials.');
    }
    if (users[sender].balance < amount) {
        return res.status(400).send('Insufficient balance.');
    }
    if (!users[receiver]) {
        return res.status(400).send('Receiver not found.');
    }
    
    users[sender].balance -= amount;
    users[receiver].balance += amount;
    const cashback = amount * 0.33;
    users[sender].balance += cashback;
    
    res.send(`Transfer successful. You received ${cashback} ESD cashback. Your new balance is ${users[sender].balance} ESD.`);
});

app.listen(3000, () => {
    console.log('ESD server running on port 3000');
});
