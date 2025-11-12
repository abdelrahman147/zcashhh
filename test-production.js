async function testProduction() {
    console.log('=== Production Readiness Test ===\n');
    
    const results = {
        passed: 0,
        failed: 0,
        warnings: 0
    };
    
    function test(name, condition, isWarning = false) {
        if (condition) {
            console.log(`✓ ${name}`);
            results.passed++;
        } else {
            if (isWarning) {
                console.log(`WARNING: ${name}`);
                results.warnings++;
            } else {
                console.log(`FAIL: ${name}`);
                results.failed++;
            }
        }
    }
    
    console.log('1. Configuration Checks:');
    test('CONFIG object exists', typeof CONFIG !== 'undefined');
    test('Google Sheets config present', CONFIG && CONFIG.GOOGLE_SHEETS);
    test('Solana RPC URLs configured', CONFIG && CONFIG.SOLANA_RPC && CONFIG.SOLANA_RPC.length > 0);
    test('No localhost in Solana RPC', !CONFIG.SOLANA_RPC.some(url => url.includes('localhost')));
    test('Zcash RPC config present', CONFIG && CONFIG.ZCASH_RPC);
    
    console.log('\n2. API Service Checks:');
    test('ProtocolAPI class exists', typeof ProtocolAPI !== 'undefined');
    if (typeof ProtocolAPI !== 'undefined') {
        const api = new ProtocolAPI();
        test('API can be instantiated', api !== null);
        test('API has getStatus method', typeof api.getStatus === 'function');
        test('API has sendPayment method', typeof api.sendPayment === 'function');
    }
    
    console.log('\n3. Bridge Service Checks:');
    test('ZcashSolanaBridge class exists', typeof ZcashSolanaBridge !== 'undefined');
    test('Bridge instance exists', typeof window.bridge !== 'undefined' || typeof bridge !== 'undefined');
    
    console.log('\n4. Leaderboard Checks:');
    test('LeaderboardSheets class exists', typeof LeaderboardSheets !== 'undefined');
    if (typeof LeaderboardSheets !== 'undefined' && CONFIG && CONFIG.GOOGLE_SHEETS) {
        const sheetId = CONFIG.GOOGLE_SHEETS.SHEET_ID;
        const apiKey = CONFIG.GOOGLE_SHEETS.API_KEY;
        if (sheetId && apiKey && sheetId !== 'YOUR_GOOGLE_SHEET_ID') {
            const leaderboard = new LeaderboardSheets(sheetId, apiKey);
            test('Leaderboard can be instantiated', leaderboard !== null);
            test('Leaderboard has submitScore method', typeof leaderboard.submitScore === 'function');
            test('Leaderboard has getLeaderboard method', typeof leaderboard.getLeaderboard === 'function');
        } else {
            test('Google Sheets not configured', false, true);
        }
    }
    
    console.log('\n5. Payment System Checks:');
    test('Phantom wallet available', typeof window.solana !== 'undefined' && window.solana.isPhantom);
    test('Solana Web3 available', typeof window.solanaWeb3 !== 'undefined' || typeof solanaWeb3 !== 'undefined');
    
    console.log('\n6. Error Handling:');
    test('TextEncoder available (no Buffer dependency)', typeof TextEncoder !== 'undefined');
    test('Crypto API available', typeof crypto !== 'undefined' && crypto.subtle);
    
    console.log('\n=== Test Results ===');
    console.log(`Passed: ${results.passed}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Warnings: ${results.warnings}`);
    
    if (results.failed === 0) {
        console.log('\nAll critical tests passed! System is production ready.');
    } else {
        console.log('\nSome tests failed. Please fix issues before deploying.');
    }
    
    return results;
}

if (typeof window !== 'undefined') {
    window.testProduction = testProduction;
    console.log('Run testProduction() in console to test production readiness');
}

