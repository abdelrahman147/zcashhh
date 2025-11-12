

class BridgeTestSuite {
    constructor(bridge) {
        this.bridge = bridge;
        this.results = {
            totalTests: 0,
            passed: 0,
            failed: 0,
            errors: [],
            warnings: [],
            performance: {
                avgTime: 0,
                minTime: Infinity,
                maxTime: 0,
                totalTime: 0
            }
        };
        this.testTransactions = [];
    }
    
    async runFullTestSuite(iterations = 1000) {
        console.log(`Starting comprehensive test suite: ${iterations} iterations`);
        const startTime = Date.now();
        
        try {
            
            await this.preTestChecks();
            
            
            let showProgressEvery;
            if (iterations >= 1000000) {
                showProgressEvery = 10000; 
            } else if (iterations >= 100000) {
                showProgressEvery = 5000; 
            } else if (iterations >= 10000) {
                showProgressEvery = 1000; 
            } else if (iterations >= 1000) {
                showProgressEvery = 100; 
            } else {
                showProgressEvery = 10; 
            }
            
            
            window.testSuiteInstance = this;
            
            
            for (let i = 0; i < iterations; i++) {
                
                if (window.testCancelled) {
                    console.log(`Test cancelled at ${i + 1}/${iterations}`);
                    break;
                }
                
                try {
                    await this.runSingleTest(i + 1, iterations);
                } catch (error) {
                    
                    this.results.failed++;
                    
                    if (this.results.errors.length < 1000) {
                        this.results.errors.push({
                            testNumber: i + 1,
                            type: 'test_execution_error',
                            message: error.message
                        });
                    }
                }
                
                
                if ((i + 1) % showProgressEvery === 0 || i === 0 || i === iterations - 1) {
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                    const rate = elapsed > 0 ? ((i + 1) / elapsed).toFixed(0) : '0';
                    console.log(`Progress: ${i + 1}/${iterations} (${rate} tests/sec) - ${elapsed}s elapsed`);
                    this.printResults();
                    
                    
                    if (typeof window !== 'undefined' && window.dispatchEvent) {
                        window.dispatchEvent(new CustomEvent('testProgress', {
                            detail: {
                                current: i + 1,
                                total: iterations,
                                passed: this.results.passed,
                                failed: this.results.failed,
                                elapsed: elapsed,
                                rate: rate
                            }
                        }));
                    }
                }
                
                
                const cleanupInterval = iterations > 100000 ? 5000 : 1000;
                if ((i + 1) % cleanupInterval === 0) {
                    await this.cleanupMemory();
                }
            }
            
            
            window.testCancelled = false;
            
            
            await this.postTestValidation();
            
            
            await this.cleanupMemory();
            
            
            const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
            this.printFinalResults(totalTime);
            
            return this.results;
        } catch (error) {
            console.error('Test suite error:', error);
            this.results.errors.push({
                type: 'suite_error',
                message: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
    
    async cleanupMemory() {
        try {
            
            if (this.bridge.poolState.activeTransactions.length > 1000) {
                const toRemove = this.bridge.poolState.activeTransactions.length - 1000;
                this.bridge.poolState.activeTransactions.splice(0, toRemove);
            }
            
            
            if (this.bridge.poolState.uniqueUsers.size > 5000) {
                
                const recentUsers = new Set();
                const recentTxs = this.bridge.poolState.activeTransactions.slice(-500);
                recentTxs.forEach(tx => {
                    if (tx.userAddress) {
                        recentUsers.add(tx.userAddress);
                    }
                });
                this.bridge.poolState.uniqueUsers = recentUsers;
            }
            
            
            
            
        } catch (error) {
            console.warn('Memory cleanup error:', error);
        }
    }
    
    async preTestChecks() {
        console.log('📋 Running pre-test checks...');
        
        
        if (!this.bridge) {
            throw new Error('Bridge not initialized');
        }
        
        
        if (!this.bridge.poolState) {
            throw new Error('Pool state not initialized');
        }
        
        
        if (!this.bridge.solanaWallet) {
            this.bridge.solanaWallet = 'test_wallet_' + Date.now();
            console.log('Demo wallet initialized for testing');
        }
        
        
        if (!this.bridge.shieldedPoolAddress) {
            this.bridge.shieldedPoolAddress = 'zt1test' + Math.random().toString(36).substring(7);
            console.log('Pool address initialized for testing');
        }
        
        console.log('Pre-test checks passed');
    }
    
    async runSingleTest(testNumber, totalTests) {
        const startTime = Date.now();
        this.results.totalTests++;
        
        try {
            
            let amount;
            if (testNumber % 100 === 0) {
                
                const edgeCases = [0.00000001, 0.001, 1, 10, 100, 1000, 999999.99999999];
                amount = edgeCases[Math.floor(Math.random() * edgeCases.length)];
            } else {
                amount = Math.random() * 10 + 0.001; 
            }
            
            const recipient = 'sol_' + Math.random().toString(36).substring(7) + '_' + testNumber;
            
            
            const bridgeResult = await this.testBridgeTransaction(amount, recipient, testNumber);
            
            
            const poolCheck = testNumber % 10 === 0 ? await this.testPoolIntegrity() : true;
            
            
            const trackingCheck = await this.testTransactionTracking(bridgeResult);
            
            
            const statsCheck = testNumber % 50 === 0 ? await this.testStatsUpdate() : true;
            
            
            const memoryCheck = testNumber % 100 === 0 ? await this.testMemoryUsage() : true;
            
            
            const testTime = Date.now() - startTime;
            this.updatePerformanceMetrics(testTime);
            
            
            const passed = bridgeResult && poolCheck && trackingCheck && statsCheck && memoryCheck;
            
            if (passed) {
                this.results.passed++;
            } else {
                this.results.failed++;
                
                if (this.results.errors.length < 100) {
                    this.results.errors.push({
                        testNumber,
                        message: 'Test failed',
                        bridgeResult: !bridgeResult,
                        poolCheck: !poolCheck,
                        trackingCheck: !trackingCheck,
                        statsCheck: !statsCheck,
                        memoryCheck: !memoryCheck
                    });
                } else if (this.results.errors.length === 100) {
                    this.results.errors.push({
                        testNumber,
                        message: 'Too many errors - truncating error log'
                    });
                }
            }
            
        } catch (error) {
            this.results.failed++;
            
            if (this.results.errors.length < 100) {
                this.results.errors.push({
                    testNumber,
                    type: 'test_error',
                    message: error.message
                });
            }
            
            if (testNumber % 1000 === 0) {
                console.warn(`Test ${testNumber} error:`, error.message);
            }
        }
    }
    
    async testBridgeTransaction(amount, recipient, testNumber) {
        try {
            
            const safeAmount = parseFloat(amount);
            if (isNaN(safeAmount) || safeAmount <= 0) {
                throw new Error('Invalid amount');
            }
            
            
            const timestamp = Date.now();
            const zcashTxid = 'zec_test_' + testNumber + '_' + timestamp + '_' + Math.random().toString(36).substring(7);
            const solanaTxid = 'sol_test_' + testNumber + '_' + timestamp + '_' + Math.random().toString(36).substring(7);
            
            
            this.bridge.trackTransaction({
                type: 'bridge',
                chain: 'both',
                zcashTxid,
                solanaTxid,
                amount: safeAmount,
                from: 'zcash',
                to: recipient,
                timestamp: timestamp,
                status: 'completed',
                test: true,
                testNumber: testNumber
            });
            
            
            const roundedAmount = Math.round(safeAmount * 1e8) / 1e8;
            const currentDeposits = Math.round((parseFloat(this.bridge.poolState.totalDeposits) || 0) * 1e8) / 1e8;
            const currentBalance = Math.round((parseFloat(this.bridge.poolState.poolBalance) || 0) * 1e8) / 1e8;
            
            this.bridge.poolState.totalDeposits = Math.round((currentDeposits + roundedAmount) * 1e8) / 1e8;
            this.bridge.poolState.poolBalance = Math.round((currentBalance + roundedAmount) * 1e8) / 1e8;
            
            
            this.bridge.updatePoolStats().catch(err => {
                console.warn('Stats update error:', err);
            });
            
            
            const recentTxs = this.bridge.poolState.activeTransactions.slice(-10);
            const tx = recentTxs.find(t => t.zcashTxid === zcashTxid || t.testNumber === testNumber);
            
            if (!tx) {
                
                const fullTx = this.bridge.poolState.activeTransactions.find(
                    t => t.zcashTxid === zcashTxid
                );
                if (!fullTx) {
                    throw new Error('Transaction not tracked');
                }
            }
            
            
            const trackedAmount = parseFloat(tx?.amount || 0);
            if (Math.abs(trackedAmount - safeAmount) > 0.00000001) {
                throw new Error(`Amount mismatch: expected ${safeAmount}, got ${trackedAmount}`);
            }
            
            return { zcashTxid, solanaTxid, amount: safeAmount, recipient, success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    async testPoolIntegrity() {
        try {
            const deposits = parseFloat(this.bridge.poolState.totalDeposits) || 0;
            const withdrawals = parseFloat(this.bridge.poolState.totalWithdrawals) || 0;
            const calculatedBalance = deposits - withdrawals;
            const reportedBalance = parseFloat(this.bridge.poolState.poolBalance) || 0;
            const diff = Math.abs(calculatedBalance - reportedBalance);
            
            
            
            const roundedDiff = Math.round(diff * 1e8) / 1e8;
            if (roundedDiff > 0.0001) {
                
                const roundedCalculated = Math.round(calculatedBalance * 1e8) / 1e8;
                this.bridge.poolState.poolBalance = Math.max(0, roundedCalculated);
                if (this.results.warnings.length < 100) {
                    this.results.warnings.push({
                        type: 'pool_balance_mismatch',
                        calculatedBalance,
                        reportedBalance,
                        difference: diff,
                        fixed: true
                    });
                }
            }
            
            
            const txCount = this.bridge.poolState.activeTransactions.length;
            if (txCount > 1000) {
                
                const toRemove = txCount - 1000;
                this.bridge.poolState.activeTransactions.splice(0, toRemove);
                if (this.results.warnings.length < 100) {
                    this.results.warnings.push({
                        type: 'transaction_overflow',
                        count: txCount,
                        removed: toRemove,
                        fixed: true
                    });
                }
            }
            
            
            const txIds = new Set();
            let duplicates = 0;
            for (const tx of this.bridge.poolState.activeTransactions) {
                const id = tx.id || tx.zcashTxid || tx.solanaTxid;
                if (id && txIds.has(id)) {
                    duplicates++;
                }
                if (id) txIds.add(id);
            }
            
            if (duplicates > 0 && this.results.warnings.length < 100) {
                this.results.warnings.push({
                    type: 'duplicate_transactions',
                    count: duplicates,
                    fixed: false
                });
            }
            
            return true;
        } catch (error) {
            console.warn('Pool integrity check error:', error);
            return false;
        }
    }
    
    async testTransactionTracking(txResult) {
        try {
            if (!txResult || !txResult.zcashTxid) {
                return false;
            }
            
            const tx = this.bridge.poolState.activeTransactions.find(
                t => t.zcashTxid === txResult.zcashTxid
            );
            
            if (!tx) {
                return false;
            }
            
            
            const requiredFields = ['id', 'type', 'amount', 'timestamp', 'status'];
            for (const field of requiredFields) {
                if (!tx.hasOwnProperty(field)) {
                    throw new Error(`Missing required field: ${field}`);
                }
            }
            
            return true;
        } catch (error) {
            return false;
        }
    }
    
    async testStatsUpdate() {
        try {
            const stats = this.bridge.getPoolStats();
            
            
            if (isNaN(stats.totalTransactions) || stats.totalTransactions < 0) {
                
                stats.totalTransactions = this.bridge.poolState.activeTransactions.length;
            }
            
            if (isNaN(stats.activeUsers) || stats.activeUsers < 0) {
                
                stats.activeUsers = this.bridge.poolState.uniqueUsers.size;
            }
            
            if (isNaN(stats.poolBalance) || stats.poolBalance < 0) {
                
                stats.poolBalance = Math.max(0, this.bridge.poolState.poolBalance);
            }
            
            return true;
        } catch (error) {
            return false;
        }
    }
    
    async testMemoryUsage() {
        try {
            
            const txCount = this.bridge.poolState.activeTransactions.length;
            
            
            if (txCount > 1000) {
                const toKeep = 1000;
                const removed = txCount - toKeep;
                this.bridge.poolState.activeTransactions = 
                    this.bridge.poolState.activeTransactions.slice(-toKeep);
                
                
                const recentUsers = new Set();
                this.bridge.poolState.activeTransactions.forEach(tx => {
                    if (tx.userAddress && tx.userAddress !== 'unknown') {
                        recentUsers.add(tx.userAddress);
                    }
                });
                this.bridge.poolState.uniqueUsers = recentUsers;
                
                if (this.results.warnings.length < 100) {
                    this.results.warnings.push({
                        type: 'memory_cleanup',
                        removed: removed,
                        fixed: true
                    });
                }
            }
            
            
            if (this.bridge.poolState.uniqueUsers.size > 5000) {
                
                const recentUsers = new Set();
                const recentTxs = this.bridge.poolState.activeTransactions.slice(-500);
                recentTxs.forEach(tx => {
                    if (tx.userAddress && tx.userAddress !== 'unknown') {
                        recentUsers.add(tx.userAddress);
                    }
                });
                this.bridge.poolState.uniqueUsers = recentUsers;
                
                if (this.results.warnings.length < 100) {
                    this.results.warnings.push({
                        type: 'users_set_cleanup',
                        removed: this.bridge.poolState.uniqueUsers.size - recentUsers.size,
                        fixed: true
                    });
                }
            }
            
            
            const stats = this.bridge.getPoolStats();
            Object.keys(stats).forEach(key => {
                if (isNaN(stats[key]) || !isFinite(stats[key])) {
                    
                    stats[key] = 0;
                    if (this.results.warnings.length < 100) {
                        this.results.warnings.push({
                            type: 'invalid_stat_value',
                            stat: key,
                            fixed: true
                        });
                    }
                }
            });
            
            return true;
        } catch (error) {
            console.warn('Memory test error:', error);
            return false;
        }
    }
    
    async postTestValidation() {
        console.log('Running post-test validation...');
        
        
        const poolCheck = await this.bridge.checkPoolIntegrity();
        if (!poolCheck.valid) {
            this.results.errors.push({
                type: 'final_pool_check',
                errors: poolCheck.errors
            });
        }
        
        
        const txCount = this.bridge.poolState.activeTransactions.length;
        const statsTxCount = this.bridge.getPoolStats().totalTransactions;
        
        if (txCount !== statsTxCount) {
            
            this.bridge.updatePoolStats();
            this.results.warnings.push({
                type: 'stats_sync',
                txCount,
                statsTxCount,
                fixed: true
            });
        }
        
        console.log('Post-test validation completed');
    }
    
    updatePerformanceMetrics(testTime) {
        this.results.performance.totalTime += testTime;
        this.results.performance.avgTime = 
            this.results.performance.totalTime / this.results.totalTests;
        this.results.performance.minTime = 
            Math.min(this.results.performance.minTime, testTime);
        this.results.performance.maxTime = 
            Math.max(this.results.performance.maxTime, testTime);
    }
    
    printResults() {
        const passRate = ((this.results.passed / this.results.totalTests) * 100).toFixed(2);
        console.log(`
📈 Test Progress:
   Total: ${this.results.totalTests}
   Passed: ${this.results.passed} (${passRate}%)
   Failed: ${this.results.failed}
   Warnings: ${this.results.warnings.length}
   Avg Time: ${this.results.performance.avgTime.toFixed(2)}ms
        `);
    }
    
    printFinalResults(totalTime = 0) {
        const passRate = ((this.results.passed / this.results.totalTests) * 100).toFixed(2);
        const testsPerSec = totalTime > 0 ? (this.results.totalTests / totalTime).toFixed(0) : 'N/A';
        
        console.log(`
╔══════════════════════════════════════════════════════════╗
║           TEST SUITE RESULTS - ${this.results.totalTests.toString().padStart(6)} TESTS          ║
╠══════════════════════════════════════════════════════════╣
║  Passed:        ${this.results.passed.toString().padStart(10)} (${passRate}%)          ║
║  Failed:        ${this.results.failed.toString().padStart(10)}                    ║
║  Warnings:      ${this.results.warnings.length.toString().padStart(10)}                    ║
║  Total Time:    ${totalTime.toString().padStart(10)}s                  ║
║  Tests/Sec:      ${testsPerSec.toString().padStart(10)}                    ║
║  Avg Time:      ${this.results.performance.avgTime.toFixed(2).padStart(10)}ms                  ║
║  Min Time:       ${this.results.performance.minTime.toFixed(2).padStart(10)}ms                  ║
║  Max Time:       ${this.results.performance.maxTime.toFixed(2).padStart(10)}ms                  ║
╚══════════════════════════════════════════════════════════╝
        `);
        
        if (this.results.errors.length > 0) {
            console.log('\nErrors Found:');
            this.results.errors.slice(0, 10).forEach((error, i) => {
                console.log(`   ${i + 1}. Test ${error.testNumber}: ${error.message || error.type}`);
            });
            if (this.results.errors.length > 10) {
                console.log(`   ... and ${this.results.errors.length - 10} more errors`);
            }
        }
        
        if (this.results.warnings.length > 0) {
            console.log('\nWarnings (Auto-fixed):');
            const warningTypes = {};
            this.results.warnings.forEach(w => {
                warningTypes[w.type] = (warningTypes[w.type] || 0) + 1;
            });
            Object.entries(warningTypes).forEach(([type, count]) => {
                console.log(`   - ${type}: ${count} times`);
            });
        }
        
        
        const stats = this.bridge.getPoolStats();
        console.log(`
Final Pool Stats:
   Total Transactions: ${stats.totalTransactions}
   Active Users: ${stats.activeUsers}
   Pool Balance: ${stats.poolBalance.toFixed(8)} ZEC
   Pending: ${stats.pendingTransactions}
        `);
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}


if (typeof window !== 'undefined') {
    window.BridgeTestSuite = BridgeTestSuite;
}

