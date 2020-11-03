const { LinkToken: LinkTokenContract } = require('@chainlink/contracts/truffle/v0.4/LinkToken')
const { Oracle: OracleContract } = require('@chainlink/contracts/truffle/v0.6/Oracle');
const { BigNumber } = require("@ethersproject/bignumber");
const fs = require('fs');
const waitOn = require('wait-on');
const clUtils = require('../chainlink/cl-utils');
const { spawnSync } = require('child_process')


async function main(env) {
  while(!(await env.ethers.getDefaultProvider().ready)) { }
  console.log('Connected to ganache')
  const [signer] = await env.ethers.getSigners();
  console.log('Got signers')
  var { oracleContract } = await deployChainlinkContracts(signer, env);
  
  await initializeChainlinkNode(oracleContract, signer);
}

async function initializeChainlinkNode(oracleContract, signer, env) {
  await startChainlinkNode(env);

  const jobId = await createOracleFetchJob(oracleContract, env);

  await authorizeChainlinkNode(oracleContract, signer, env);
  return {
    jobId
  };
}

async function createOracleFetchJob(oracleContract, env) {
  const fetchJob = clUtils.createJob('runlog');
  fetchJob.initiators[0].params.address = oracleContract.address;
  fetchJob.tasks.push(clUtils.createTask('httpgetwithunrestrictednetworkaccess')); //instead of httpget
  fetchJob.tasks.push(clUtils.createTask('jsonparse'));
  fetchJob.tasks.push(clUtils.createTask('ethtx'));
  console.log('Creating timestamp job on Chainlink node...');
  const fetchJobResult = await clUtils.postJob(fetchJob);
  console.log(`Job created! Job ID: ${fetchJobResult.data.id}.`);
  fs.writeFileSync('./build/jobs.env', `FETCH_JOB_ID=${fetchJobResult.data.id}`)
  return fetchJobResult.data.id;
}

async function authorizeChainlinkNode(oracleContract, signer, env) {
  const accountAddr = await clUtils.getAcctAddr();
  console.log(`Setting fulfill permission to true for ${accountAddr}...`);
  const tx = await oracleContract.setFulfillmentPermission(accountAddr, true);
  console.log(`Fulfillment succeeded! Transaction ID: ${tx.tx}.`);

  await fundChainlinkNode(accountAddr, signer, env);
  
}

async function fundChainlinkNode(accountAddr, signer, env) {
  console.log(`Sending 1 ETH from ${signer.address} to ${accountAddr}.`);
  const result = await signer.sendTransaction({ from: signer.address, to: accountAddr, value: BigNumber.from('10000000000000000') });
  console.log(`Transfer succeeded! Transaction ID: ${result.transactionHash}.`);
}

async function deployChainlinkContracts(signer, env) {
  var linkContract = {
    address: '0x514910771af9ca656af840dff83e8264ecf986ca'
  }
  console.log('Deployed link');
  var oracleContract = await env.waffle.deployContract(signer, OracleContract, [linkContract.address]);
  console.log('Deployed oracle');
  fs.writeFileSync('./build/addrs.env', `LINK_CONTRACT_ADDRESS=${linkContract.address}\nORACLE_CONTRACT_ADDRESS=${oracleContract.address}`);
  return { oracleContract, linkContract };
}

async function startChainlinkNode(env) {
  console.log('Starting chainlink service');
  const runChainlink = spawnSync('docker-compose', ['up', '--no-deps', '-d', 'chainlink']);
  
  var opts = {
    resources: [
      'http://localhost:6688'
    ],
    validateStatus: function (status) {
      return status >= 200 && status < 300; // default if not provided
    },
  };

  await waitOn(opts);
}

module.exports = {
  initializeChainlinkNode,
  main
}