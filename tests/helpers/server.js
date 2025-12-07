/**
 * Server Helper for LichtBlick E2E Tests
 * Handles server lifecycle (start/stop/health checks)
 */

const { spawn } = require('child_process');
const path = require('path');

let serverProcess = null;

/**
 * Start the LichtBlick server
 * @param {Object} options - Server options
 * @returns {Promise<Object>} Server process and admin token
 */
async function startServer(options = {}) {
  const {
    port = 3000,
    maxWaitTime = 30000,
    env = {}
  } = options;

  console.log('Starting LichtBlick server...');

  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, '../../server/index.js');
    
    // Start server process
    serverProcess = spawn('node', [serverPath], {
      cwd: path.join(__dirname, '../../server'),
      env: {
        ...process.env,
        ...env,
        PORT: port,
        NODE_ENV: 'test'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let adminToken = null;
    let serverOutput = '';
    let errorOutput = '';
    let healthCheckInterval = null;

    // Capture stdout to extract admin token
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      serverOutput += output;
      
      // Extract admin token from output
      const tokenMatch = output.match(/Admin-URL:.*token=([A-Za-z0-9_-]+)/);
      if (tokenMatch) {
        adminToken = tokenMatch[1];
        console.log('Admin token captured:', adminToken);
      }

      // Log server output for debugging
      if (output.includes('Server listening') || output.includes('listening on')) {
        console.log('Server started successfully');
      }
    });

    // Capture stderr
    serverProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('Server error:', data.toString());
    });

    // Handle server exit
    serverProcess.on('exit', (code) => {
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
      }
      
      if (code !== 0 && code !== null) {
        console.error('Server exited with code:', code);
        console.error('Server output:', serverOutput);
        console.error('Server errors:', errorOutput);
      }
    });

    // Start health check polling
    const startTime = Date.now();
    healthCheckInterval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:${port}/api/health`);
        
        if (response.ok) {
          clearInterval(healthCheckInterval);
          console.log('Server health check passed');
          
          // Wait a bit more for admin token to appear
          setTimeout(() => {
            resolve({
              process: serverProcess,
              adminToken: adminToken,
              port: port,
              baseURL: `http://localhost:${port}`
            });
          }, 1000);
        }
      } catch (error) {
        // Health check failed, continue polling
        if (Date.now() - startTime > maxWaitTime) {
          clearInterval(healthCheckInterval);
          if (serverProcess) {
            serverProcess.kill();
          }
          reject(new Error(`Server health check timeout after ${maxWaitTime}ms. Output: ${serverOutput}`));
        }
      }
    }, 1000);

    // Timeout fallback
    setTimeout(() => {
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        if (serverProcess) {
          serverProcess.kill();
        }
        reject(new Error(`Server startup timeout after ${maxWaitTime}ms`));
      }
    }, maxWaitTime);
  });
}

/**
 * Stop the LichtBlick server
 * @param {Object} process - Server process to stop
 */
async function stopServer(process) {
  if (!process) {
    process = serverProcess;
  }

  if (process && !process.killed) {
    console.log('Stopping server...');
    
    return new Promise((resolve) => {
      process.on('exit', () => {
        console.log('Server stopped');
        serverProcess = null;
        resolve();
      });

      // Send SIGTERM for graceful shutdown
      process.kill('SIGTERM');

      // Force kill after 5 seconds if not stopped
      setTimeout(() => {
        if (process && !process.killed) {
          console.log('Force killing server...');
          process.kill('SIGKILL');
        }
        resolve();
      }, 5000);
    });
  }
}

/**
 * Check if server is healthy
 * @param {string} baseURL - Base URL of the server
 * @returns {Promise<boolean>} True if healthy
 */
async function isServerHealthy(baseURL = 'http://localhost:3000') {
  try {
    const response = await fetch(`${baseURL}/api/health`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Wait for server to be ready
 * @param {string} baseURL - Base URL of the server
 * @param {number} maxWaitMs - Maximum wait time
 * @returns {Promise<boolean>} True if ready
 */
async function waitForServer(baseURL = 'http://localhost:3000', maxWaitMs = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    if (await isServerHealthy(baseURL)) {
      return true;
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return false;
}

module.exports = { 
  startServer, 
  stopServer, 
  isServerHealthy, 
  waitForServer 
};
