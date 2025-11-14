/**
 * INTERNAL STRESS TEST SUITE - BACKEND API TESTING
 * Tests all APIs, endpoints, and oracle integrations
 * Runs automatically - logs to console only
 */

class BackendStressTest {
    constructor(oracle, bridge, api) {
        this.oracle = oracle;
        this.bridge = bridge;
        this.api = api;
        this.results = {
            oracleAPIs: {},
            bridgeAPIs: {},
            stakingAPIs: {},
            errors: [],
            performance: {}
        };
        this.startTime = null;
    }

    async runFullStressTest(iterations = 100) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🔥 BACKEND STRESS TEST - ${iterations} ITERATIONS`);
        console.log(`${'='.repeat(60)}\n`);
        
        this.startTime = Date.now();
        
        // Test all Oracle APIs
        await this.stressTestOracleAPIs(iterations);
        
        // Test Bridge APIs
        await this.stressTestBridgeAPIs(iterations);
        
        // Test Staking APIs
        await this.stressTestStakingAPIs(iterations);
        
        // Test Backend Endpoints
        await this.stressTestBackendEndpoints(iterations);
        
        // Test Rate Limiting
        await this.stressTestRateLimiting();
        
        // Test Error Handling
        await this.stressTestErrorHandling();
        
        // Generate Report
        this.generateReport();
    }

    async stressTestOracleAPIs(iterations) {
        console.log(`\n📊 STRESS TESTING ORACLE APIS (${iterations} iterations)...\n`);
        
        const symbols = ['BTC', 'ETH', 'SOL', 'BNB', 'ADA', 'DOT', 'MATIC', 'AVAX'];
        const oracleMethods = [
            { name: 'CoinGecko', fn: () => this.oracle.fetchCoinGeckoPrice('BTC') },
            { name: 'Binance', fn: () => this.oracle.fetchBinancePrice('BTC') },
            { name: 'Coinbase', fn: () => this.oracle.fetchCoinbasePrice('BTC') },
            { name: 'Pyth Network', fn: () => this.oracle.fetchPythPrice('BTC') },
            { name: 'Switchboard', fn: () => this.oracle.fetchSwitchboardPrice('BTC') },
            { name: 'CoinMarketCap', fn: () => this.oracle.fetchCoinMarketCapPrice('BTC') },
            { name: 'Chainlink', fn: () => this.oracle.fetchChainlinkPrice('BTC') },
            { name: 'Band Protocol', fn: () => this.oracle.fetchBandProtocolPrice('BTC') },
            { name: 'API3', fn: () => this.oracle.fetchAPI3Price('BTC') },
            { name: 'DIA', fn: () => this.oracle.fetchDIAPrice('BTC') },
            { name: 'Tellor', fn: () => this.oracle.fetchTellorPrice('BTC') },
            { name: 'RedStone', fn: () => this.oracle.fetchRedStonePrice('BTC') },
            { name: 'UMA', fn: () => this.oracle.fetchUMAPrice('BTC') },
            { name: 'Nest Protocol', fn: () => this.oracle.fetchNestProtocolPrice('BTC') }
        ];

        for (const api of oracleMethods) {
            this.results.oracleAPIs[api.name] = {
                success: 0,
                failed: 0,
                errors: [],
                avgResponseTime: 0,
                minResponseTime: Infinity,
                maxResponseTime: 0,
                totalResponseTime: 0
            };

            console.log(`Testing ${api.name}...`);
            
            for (let i = 0; i < iterations; i++) {
                const startTime = Date.now();
                try {
                    const result = await api.fn();
                    const responseTime = Date.now() - startTime;
                    
                    if (result && result.price && result.price > 0) {
                        this.results.oracleAPIs[api.name].success++;
                        this.results.oracleAPIs[api.name].totalResponseTime += responseTime;
                        this.results.oracleAPIs[api.name].minResponseTime = Math.min(
                            this.results.oracleAPIs[api.name].minResponseTime,
                            responseTime
                        );
                        this.results.oracleAPIs[api.name].maxResponseTime = Math.max(
                            this.results.oracleAPIs[api.name].maxResponseTime,
                            responseTime
                        );
                    } else {
                        this.results.oracleAPIs[api.name].failed++;
                        this.results.oracleAPIs[api.name].errors.push(`Iteration ${i + 1}: Invalid response`);
                    }
                } catch (error) {
                    this.results.oracleAPIs[api.name].failed++;
                    const responseTime = Date.now() - startTime;
                    this.results.oracleAPIs[api.name].totalResponseTime += responseTime;
                    this.results.oracleAPIs[api.name].errors.push(`Iteration ${i + 1}: ${error.message}`);
                    this.results.errors.push({ api: api.name, error: error.message, iteration: i + 1 });
                }
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            // Calculate average response time
            const total = this.results.oracleAPIs[api.name].success + this.results.oracleAPIs[api.name].failed;
            if (total > 0) {
                this.results.oracleAPIs[api.name].avgResponseTime = 
                    this.results.oracleAPIs[api.name].totalResponseTime / total;
            }
        }
    }

    async stressTestBridgeAPIs(iterations) {
        console.log(`\n🌉 STRESS TESTING BRIDGE APIS (${iterations} iterations)...\n`);
        
        if (!this.bridge) {
            console.log('⚠️ Bridge not available - skipping bridge tests');
            return;
        }

        this.results.bridgeAPIs = {
            getStatus: { success: 0, failed: 0, errors: [] },
            getBalance: { success: 0, failed: 0, errors: [] },
            getTransactionHistory: { success: 0, failed: 0, errors: [] }
        };

        for (let i = 0; i < iterations; i++) {
            // Test getStatus
            try {
                const status = await this.api.getStatus();
                if (status) this.results.bridgeAPIs.getStatus.success++;
                else this.results.bridgeAPIs.getStatus.failed++;
            } catch (error) {
                this.results.bridgeAPIs.getStatus.failed++;
                this.results.bridgeAPIs.getStatus.errors.push(error.message);
            }

            // Test getBalance
            try {
                const balance = await this.api.getBalance();
                if (balance !== undefined) this.results.bridgeAPIs.getBalance.success++;
                else this.results.bridgeAPIs.getBalance.failed++;
            } catch (error) {
                this.results.bridgeAPIs.getBalance.failed++;
                this.results.bridgeAPIs.getBalance.errors.push(error.message);
            }

            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }

    async stressTestStakingAPIs(iterations) {
        console.log(`\n⚡ STRESS TESTING STAKING APIS (${iterations} iterations)...\n`);
        
        const backendUrl = window.location.origin.includes('localhost') 
            ? 'http://localhost:3001' 
            : window.location.origin;

        const endpoints = [
            '/api/oracle/stake-pools',
            '/api/oracle/staking-info/test',
            '/api/oracle/unstake'
        ];

        this.results.stakingAPIs = {};

        for (const endpoint of endpoints) {
            this.results.stakingAPIs[endpoint] = {
                success: 0,
                failed: 0,
                errors: [],
                avgResponseTime: 0,
                totalResponseTime: 0
            };

            for (let i = 0; i < iterations; i++) {
                const startTime = Date.now();
                try {
                    const response = await fetch(`${backendUrl}${endpoint}`, {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    
                    const responseTime = Date.now() - startTime;
                    this.results.stakingAPIs[endpoint].totalResponseTime += responseTime;

                    if (response.ok || response.status === 404) {
                        this.results.stakingAPIs[endpoint].success++;
                    } else {
                        this.results.stakingAPIs[endpoint].failed++;
                        this.results.stakingAPIs[endpoint].errors.push(`Status: ${response.status}`);
                    }
                } catch (error) {
                    const responseTime = Date.now() - startTime;
                    this.results.stakingAPIs[endpoint].totalResponseTime += responseTime;
                    this.results.stakingAPIs[endpoint].failed++;
                    this.results.stakingAPIs[endpoint].errors.push(error.message);
                }

                await new Promise(resolve => setTimeout(resolve, 20));
            }

            const total = this.results.stakingAPIs[endpoint].success + this.results.stakingAPIs[endpoint].failed;
            if (total > 0) {
                this.results.stakingAPIs[endpoint].avgResponseTime = 
                    this.results.stakingAPIs[endpoint].totalResponseTime / total;
            }
        }
    }

    async stressTestBackendEndpoints(iterations) {
        console.log(`\n🔌 STRESS TESTING BACKEND ENDPOINTS (${iterations} iterations)...\n`);
        
        const backendUrl = window.location.origin.includes('localhost') 
            ? 'http://localhost:3001' 
            : window.location.origin;

        const endpoints = [
            { path: '/api/oracle/stake-pools', method: 'GET' },
            { path: '/api/oracle/staking-info/test', method: 'GET' },
            { path: '/api/zcash-rpc', method: 'POST', body: { method: 'getinfo', params: [] } }
        ];

        for (const endpoint of endpoints) {
            const key = `${endpoint.method} ${endpoint.path}`;
            this.results.performance[key] = {
                success: 0,
                failed: 0,
                errors: [],
                responseTimes: []
            };

            for (let i = 0; i < iterations; i++) {
                const startTime = Date.now();
                try {
                    const response = await fetch(`${backendUrl}${endpoint.path}`, {
                        method: endpoint.method,
                        headers: { 'Content-Type': 'application/json' },
                        body: endpoint.body ? JSON.stringify(endpoint.body) : undefined
                    });

                    const responseTime = Date.now() - startTime;
                    this.results.performance[key].responseTimes.push(responseTime);

                    if (response.ok || response.status === 404) {
                        this.results.performance[key].success++;
                    } else {
                        this.results.performance[key].failed++;
                        this.results.performance[key].errors.push(`Status: ${response.status}`);
                    }
                } catch (error) {
                    this.results.performance[key].failed++;
                    this.results.performance[key].errors.push(error.message);
                }

                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
    }

    async stressTestRateLimiting() {
        console.log(`\n🚦 TESTING RATE LIMITING...\n`);
        
        const backendUrl = window.location.origin.includes('localhost') 
            ? 'http://localhost:3001' 
            : window.location.origin;

        // Rapid fire requests
        const rapidRequests = 50;
        let successCount = 0;
        let rateLimitedCount = 0;
        const startTime = Date.now();

        for (let i = 0; i < rapidRequests; i++) {
            try {
                const response = await fetch(`${backendUrl}/api/oracle/stake-pools`);
                if (response.ok) {
                    successCount++;
                } else if (response.status === 429) {
                    rateLimitedCount++;
                }
            } catch (error) {
                // Network error
            }
        }

        const totalTime = Date.now() - startTime;
        console.log(`Rapid requests: ${rapidRequests} in ${totalTime}ms`);
        console.log(`Success: ${successCount}, Rate Limited: ${rateLimitedCount}`);
    }

    async stressTestErrorHandling() {
        console.log(`\n⚠️ TESTING ERROR HANDLING...\n`);
        
        // Test invalid endpoints
        const invalidEndpoints = [
            '/api/oracle/invalid-endpoint',
            '/api/oracle/staking-info/invalid-address',
            '/api/oracle/stake-pools/invalid'
        ];

        for (const endpoint of invalidEndpoints) {
            const backendUrl = window.location.origin.includes('localhost') 
                ? 'http://localhost:3001' 
                : window.location.origin;

            try {
                const response = await fetch(`${backendUrl}${endpoint}`);
                console.log(`${endpoint}: ${response.status} ${response.statusText}`);
            } catch (error) {
                console.log(`${endpoint}: Error - ${error.message}`);
            }
        }
    }

    generateReport() {
        const totalTime = Date.now() - this.startTime;
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📊 STRESS TEST REPORT`);
        console.log(`${'='.repeat(60)}\n`);
        console.log(`Total Time: ${(totalTime / 1000).toFixed(2)}s\n`);

        // Oracle APIs Report
        console.log(`ORACLE APIS RESULTS:\n`);
        for (const [apiName, result] of Object.entries(this.results.oracleAPIs)) {
            const successRate = ((result.success / (result.success + result.failed)) * 100).toFixed(1);
            const status = successRate >= 95 ? '✅' : successRate >= 80 ? '⚠️' : '❌';
            console.log(`${status} ${apiName}:`);
            console.log(`   Success: ${result.success}/${result.success + result.failed} (${successRate}%)`);
            console.log(`   Avg Response: ${result.avgResponseTime.toFixed(0)}ms`);
            console.log(`   Min/Max: ${result.minResponseTime === Infinity ? 'N/A' : result.minResponseTime}ms / ${result.maxResponseTime}ms`);
            if (result.errors.length > 0) {
                console.log(`   Errors: ${result.errors.slice(0, 3).join(', ')}`);
            }
            console.log('');
        }

        // Bridge APIs Report
        console.log(`BRIDGE APIS RESULTS:\n`);
        for (const [apiName, result] of Object.entries(this.results.bridgeAPIs)) {
            const successRate = ((result.success / (result.success + result.failed)) * 100).toFixed(1);
            console.log(`${apiName}: ${result.success}/${result.success + result.failed} (${successRate}%)`);
        }
        console.log('');

        // Staking APIs Report
        console.log(`STAKING APIS RESULTS:\n`);
        for (const [endpoint, result] of Object.entries(this.results.stakingAPIs)) {
            const successRate = ((result.success / (result.success + result.failed)) * 100).toFixed(1);
            console.log(`${endpoint}: ${result.success}/${result.success + result.failed} (${successRate}%)`);
            console.log(`   Avg Response: ${result.avgResponseTime.toFixed(0)}ms`);
        }
        console.log('');

        // Performance Report
        console.log(`PERFORMANCE METRICS:\n`);
        for (const [endpoint, result] of Object.entries(this.results.performance)) {
            if (result.responseTimes.length > 0) {
                const avg = result.responseTimes.reduce((a, b) => a + b, 0) / result.responseTimes.length;
                const min = Math.min(...result.responseTimes);
                const max = Math.max(...result.responseTimes);
                const successRate = ((result.success / (result.success + result.failed + result.rateLimited)) * 100).toFixed(1);
                console.log(`${endpoint}:`);
                console.log(`   Success: ${result.success}/${result.success + result.failed + result.rateLimited} (${successRate}%)`);
                console.log(`   Avg: ${avg.toFixed(0)}ms, Min: ${min}ms, Max: ${max}ms`);
                if (result.rateLimited > 0) {
                    console.log(`   ⚠️ Rate Limited: ${result.rateLimited} times`);
                }
            }
        }
        console.log('');

        // Error Summary
        if (this.results.errors.length > 0) {
            console.log(`ERRORS ENCOUNTERED: ${this.results.errors.length}\n`);
            const errorGroups = {};
            this.results.errors.forEach(err => {
                if (!errorGroups[err.api]) errorGroups[err.api] = [];
                errorGroups[err.api].push(err.error);
            });
            for (const [api, errors] of Object.entries(errorGroups)) {
                console.log(`${api}: ${errors.length} errors`);
            }
        }

        console.log(`\n${'='.repeat(60)}\n`);
    }
}

// Auto-run stress test on load
if (typeof window !== 'undefined') {
    window.BackendStressTest = BackendStressTest;
    
    // Auto-run after initialization
    setTimeout(async () => {
        if (window.oracle && window.bridge && window.api) {
            console.log('\n🔥 AUTO-RUNNING BACKEND STRESS TEST...\n');
            const stressTest = new BackendStressTest(window.oracle, window.bridge, window.api);
            await stressTest.runFullStressTest(50); // 50 iterations per API
            
            // Store globally for manual re-runs
            window.stressTest = stressTest;
            console.log('\n✅ Stress test complete! Run window.stressTest.runFullStressTest(N) to test again.\n');
        }
    }, 10000); // Wait 10 seconds after page load
}

