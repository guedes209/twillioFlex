const shell = require("shelljs");
var { setPluginName, getPaths } = require("./select-plugin");

const serverlessDir = 'serverless-functions';
const scheduleManagerServerlessDir = 'serverless-schedule-manager';
const flexConfigDir = 'flex-config';
const serverlessSrc = `${serverlessDir}/src`;
const flexConfigTemplateDir = `${flexConfigDir}/template-files`

// the following function will use twilio cli
// to try to fetch the sids of template dependencies based on typical 
// dependency names.  

// It will always return an object and if its been succesfull the sids will
// be populated on the return object

// this function is expected to run with either an active profile set
// or with the following environment variables set
//    TWILIO_ACCOUNT_SID, 
//    TWILIO_API_KEY, 
//    TWILIO_API_SECRET
exports.getEnvironmentVariables = function getEnvironmentVariables() {

  var result = {};

  try {
    const FLEX_WORKSPACE_NAME = "Flex Task Assignment";
    const SYNC_SERVICE_NAME = "Default Service";
    const CHAT_SERVICE_NAME = /(Flex.*Service)/

    const ANYONE_WORKFLOW_NAME = /(Assign.*Anyone)/
    const CHAT_WORRKFLOW_NAME = "Chat Transfer"
    const CALLBACK_WORKFLOW_NAME = "Callback"
    const INTERNAL_CALL_WORKFLOW_NAME = "Internal Call";

    const SERVERLESS_FUNCTIONS_SERVICE_NAME = "custom-flex-extensions-serverless"
    const SCHEDULE_MANAGER_SERVICE_NAME = "schedule-manager"


    console.log("Loading environment variables..");

    result.taskrouter_workspace_sid = shell.exec("twilio api:taskrouter:v1:workspaces:list", {silent: true}).grep(FLEX_WORKSPACE_NAME).stdout.split(" ")[0]
    result.sync_sid = shell.exec("twilio api:sync:v1:services:list", {silent: true}).grep(SYNC_SERVICE_NAME).stdout.split(" ")[0]
    result.chat_sid = shell.exec("twilio api:chat:v2:services:list", {silent: true}).grep(CHAT_SERVICE_NAME).stdout.split(" ")[0]

    var workflows = shell.exec(`twilio api:taskrouter:v1:workspaces:workflows:list --workspace-sid=${result.taskrouter_workspace_sid}`, {silent: true});
    result.everyoneWorkflow = workflows.grep(ANYONE_WORKFLOW_NAME).stdout.split(" ")[0].trim();
    result.chatTransferWorkFlow = workflows.grep(CHAT_WORRKFLOW_NAME).stdout.split(" ")[0].trim();
    result.callbackWorkflow = workflows.grep(CALLBACK_WORKFLOW_NAME).stdout.split(" ")[0].trim();
    result.internalCallWorkflow = workflows.grep(INTERNAL_CALL_WORKFLOW_NAME).stdout.split(" ")[0].trim();

    result.serviceFunctionsSid = shell.exec("twilio api:serverless:v1:services:list", {silent: true}).grep(SERVERLESS_FUNCTIONS_SERVICE_NAME).stdout.split(" ")[0]
    result.serviceFunctionsDomain = shell.exec(`twilio api:serverless:v1:services:environments:list --service-sid=${result.serviceFunctionsSid}`, {silent: true}).grep(SERVERLESS_FUNCTIONS_SERVICE_NAME).stdout.split(" ")[4]

    result.scheduleFunctionsSid = shell.exec("twilio api:serverless:v1:services:list", {silent: true}).grep(SCHEDULE_MANAGER_SERVICE_NAME).stdout.split(" ")[0]
    result.scheduledFunctionsDomain = shell.exec(`twilio api:serverless:v1:services:environments:list --service-sid=${result.scheduleFunctionsSid}`, {silent: true}).grep(SCHEDULE_MANAGER_SERVICE_NAME).stdout.split(" ")[4]

    console.log("\tDone fetching environment variables");
    console.log("");

    return result;

  } catch (error) {
    console.warn("Error trying to load environment variables");
    console.error(error);
    return result;
  }
}

exports.getActiveTwilioProfile = async function getActiveTwilioProfile() {

  var result = {};
  
  try{
    result.profile = await shell.exec("twilio profiles:list", {silent: true}).grep("true").stdout;
    result.profile_name = result.profile.split(" ")[0].trim().trim();
    result.account_sid = result.profile.match(/AC[0-9,a-z,A-Z]{32}/)[0];

    return result;

  } catch (error) {
    console.warn("Unable to detect active twilio profile");
    console.log("");
    return result;
  }

}

exports.installNPMServerlessFunctions = function installNPMServerlessFunctions() {
  console.log("Installing npm dependencies for serverless functions..");
  shell.exec("npm --prefix ./serverless-functions ci ./serverless-functions", {silent:true});
}

exports.installNPMFlexConfig = function installNPMFlexConfig() {
  console.log("Installing npm dependencies for flex-config...");
  shell.exec("npm --prefix ./flex-config ci ./flex-config", {silent:true});
}

exports.installNPMPlugin = function installNPMPlugin() {

  setPluginName("v1");
  var { pluginDir } = getPaths();
  var temp = pluginDir;
  if( pluginDir && pluginDir != "" ) {
    console.log(`Installing npm dependencies for ${pluginDir}...`);
    shell.exec(`npm --prefix ./${pluginDir} ci ./${pluginDir}`, {silent:true});
  }

  setPluginName("v2");
  var { pluginDir } = getPaths();
  if ( pluginDir && temp != pluginDir && pluginDir != "" ) {
    console.log(`Installing npm dependencies for ${pluginDir}...`);
    shell.exec(`npm --prefix ./${pluginDir} ci ./${pluginDir}`, {silent:true});
  }
}

exports.generateServerlessFunctionsEnv = function generateServerlessFunctionsEnv(context, serverlessEnv) {

  try {
    const serverlessEnvExample = `./${serverlessDir}/.env.example`;
    var {
      account_sid, 
      auth_token, 
      api_key, 
      api_secret, 
      taskrouter_workspace_sid, 
      sync_sid, 
      chat_sid, 
      callbackWorkflow, 
      everyoneWorkflow, 
      internalCallWorkflow, 
      chatTransferWorkFlow } = context

    if(process.env.TWILIO_API_KEY && !api_key) api_key = process.env.TWILIO_API_KEY;
    if(process.env.TWILIO_API_SECRET && !api_secret) api_secret = process.env.TWILIO_API_SECRET;

    if(!shell.test('-e', serverlessEnv)){
      shell.cp(serverlessEnvExample, serverlessEnv);
    }
    if(shell.test('-e', serverlessEnv)){
      if(account_sid){
        shell.sed('-i', /<YOUR_TWILIO_ACCOUNT_SID>/g, `${account_sid}`, serverlessEnv);
      }
      if(auth_token){
        shell.sed('-i', /<YOUR_TWILIO_AUTH_TOKEN>/g, `${auth_token}`, serverlessEnv);
      }
      if(api_key){
        shell.sed('-i', /<YOUR_API_KEY>/g, `${api_key}`, serverlessEnv);
      }
      if(api_secret){
        shell.sed('-i', /<YOUR_API_SECRET>/g, `${api_secret}`, serverlessEnv);
      }
      if(taskrouter_workspace_sid){
        shell.sed('-i', /<YOUR_FLEX_WORKSPACE_SID>/g, `${taskrouter_workspace_sid}`, serverlessEnv);
      }
      if(sync_sid){
        shell.sed('-i', /<YOUR_FLEX_SYNC_SID>/g, `${sync_sid}`, serverlessEnv);
      }
      if(chat_sid){
        shell.sed('-i', /<YOUR_FLEX_CHAT_SERVICE_SID>/g, `${chat_sid}`, serverlessEnv);
      }

      if(callbackWorkflow || everyoneWorkflow){
        var workflow = callbackWorkflow?  callbackWorkflow: everyoneWorkflow;
        shell.sed('-i', /<YOUR_FLEX_CALLBACK_WORKFLOW_SID>/g, `${workflow}`, serverlessEnv);
      }
      if(internalCallWorkflow){
        shell.sed('-i', /<YOUR_FLEX_INTERNAL_CALL_WORKFLOW_SID>/g, `${internalCallWorkflow}`, serverlessEnv);
      }
      if(chatTransferWorkFlow){
        shell.sed('-i', /<YOUR_FLEX_CHAT_TRANSFER_WORKFLOW_SID>/g, `${chatTransferWorkFlow}`, serverlessEnv);
      }
      console.log(`Setting up environment ${serverlessEnv}: complete`);
    } else {
      console.warn("Unable to configure serverless environment file, it will need to be done manually");
    }
  } catch (error) {
    console.error(error);
    console.log(`Error attempting to generate serverless environment file ${serverlessEnv}`);
  }
}

exports.generateFlexConfigEnv = function generateFlexConfigEnv(context, flexConfigEnv) {

  const flexConfigEnvExample = `./${flexConfigDir}/.env.example`;
  const { 
    account_sid,
    api_key,
    api_secret } = context

  try {

    // create file from example if it does not exist  
    if(!shell.test('-e', flexConfigEnv)){
      shell.cp(flexConfigEnvExample, flexConfigEnv);
    }

    // confirm file exists and perform replacements with
    // variables when available
    if(shell.test('-e', flexConfigEnv)){
      if(account_sid){
        shell.sed('-i', /<YOUR_TWILIO_ACCOUNT_SID>/g, `${account_sid}`, flexConfigEnv);
      }
      if(api_key){
        shell.sed('-i', /<YOUR_API_KEY>/g, `${api_key}`, flexConfigEnv);
      } 
      if(api_secret){
        shell.sed('-i', /<YOUR_API_SECRET>/g, `${api_secret}`, flexConfigEnv);
      }
      console.log(`Setting up environment ${flexConfigEnv}: complete`);
    } else {
      console.warn("Unable to configure flex config environment file, it will need to be done manually");
    }
  } catch (error){
    console.error(error);
    console.log(`Error attempting to generate flex config environment file ${flexConfigEnv}`);
  }
}

exports.populateFlexConfigPlaceholders = function populateFlexConfigPlaceholders(context, environment) {

  const configFile = `./${flexConfigDir}/ui_attributes.${environment}.json`;

  var {
    scheduledFunctionsDomain,
    serviceFunctionsDomain
     } = context

    if(shell.test('-e', configFile)){
      if(serviceFunctionsDomain){
        shell.sed('-i', /<PLACEHOLDER_SERVERLESS_DOMAIN>/g, `${serviceFunctionsDomain}`, configFile);
      }
      if(serviceFunctionsDomain){
        shell.sed('-i', /<PLACEHOLDER_SCHEDULE_MANAGER_DOMAIN>/g, `${scheduledFunctionsDomain}`, configFile);
      }
    }
}

exports.generateAppConfigForPlugins = function generateAppConfigForPlugins() {

  setPluginName("v1");
  var { pluginDir } = getPaths();
  var temp = pluginDir;

  var pluginAppConfigExample = `./${pluginDir}/public/appConfig.example.js`
  var pluginAppConfig = `./${pluginDir}/public/appConfig.js`

  if(pluginDir && pluginDir != ""){
    try{

      if(!shell.test('-e', pluginAppConfig)){
        shell.cp(pluginAppConfigExample, pluginAppConfig);
      }
      console.log(`Setting up ${pluginAppConfig}: complete`);
    } catch (error) {
      console.error(error);
      console.log(`Error attempting to generate appConfig file ${pluginAppConfig}`);
    }
  }

  setPluginName("v2");
  var { pluginDir } = getPaths();
  if ( pluginDir && temp != pluginDir && pluginDir != "") {
    var pluginAppConfigExample = `./${pluginDir}/public/appConfig.example.js`
    var pluginAppConfig = `./${pluginDir}/public/appConfig.js`
  
    try{
  
      if(!shell.test('-e', pluginAppConfig)){
        shell.cp(pluginAppConfigExample, pluginAppConfig);
      }
      console.log(`Setting up ${pluginAppConfig}: complete`);
    } catch (error) {
      console.error(error);
      console.log(`Error attempting to generate appConfig file ${pluginAppConfig}`);
    }
  }

  console.log("");
}

exports.printEnvironmentSummary = function printEnvironmentSummary(context){

  const {
    taskrouter_workspace_sid, 
    sync_sid, 
    chat_sid, 
    callbackWorkflow, 
    everyoneWorkflow, 
    internalCallWorkflow, 
    chatTransferWorkFlow,
    serviceFunctionsDomain,
    scheduledFunctionsDomain } = context

    console.log("Environment configuration summary");
    console.log("");
    console.log("---- INSTANCE SIDS -----------------------------------------");
    console.log("Taskrouter Flex Workspace sid: \t\t", taskrouter_workspace_sid);
    console.log("Default Sync sid: \t\t\t", sync_sid);
    console.log("chat/conversation service sid: \t\t", chat_sid);
    console.log("");
    console.log("---- WORKFLOW SIDS -----------------------------------------");
    console.log("Assign to Anyone workflow sid: \t\t", everyoneWorkflow);
    console.log("chat transfer workflow sid: \t\t", chatTransferWorkFlow);
    console.log("callback workflow sid: \t\t\t", callbackWorkflow);
    console.log("internal call workflow sid: \t\t", internalCallWorkflow);
    console.log("");
    console.log("---- SERVERLESS DOMAINS -----------------------------------------");
    console.log("serverless functions: \t\t\t", serviceFunctionsDomain);
    console.log("schedule manager: \t\t\t", scheduledFunctionsDomain);
    console.log("");
    console.log("");
    console.log("");
}



exports.serverlessDir =  serverlessDir;
exports.scheduleManagerServerlessDir = scheduleManagerServerlessDir;
exports.flexConfigDir = flexConfigDir;



exports.serverlessSrc = serverlessSrc;
exports.flexConfigTemplateDir = flexConfigTemplateDir;

