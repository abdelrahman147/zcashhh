const fs = require('fs');

const files = {
    'leaderboard-sheets.js': {
        search: '        this.baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;\n    }',
        replace: '        this.baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;\n        this.retryCount = 0;\n        this.maxRetries = 3;\n    }'
    },
    'bridge-service.js': {
        search: "        this.zcashRpcUrl = config.zcashRpcUrl || 'http://localhost:8232';",
        replace: "        this.zcashRpcUrl = config.zcashRpcUrl || '';"
    }
};

for (const [file, {search, replace}] of Object.entries(files)) {
    try {
        let content = fs.readFileSync(file, 'utf8');
        if (content.includes(search)) {
            content = content.replace(search, replace);
            fs.writeFileSync(file, content);
            console.log(`Fixed ${file}`);
        } else {
            console.log(`${file} already fixed or pattern not found`);
        }
    } catch (error) {
        console.error(`Error fixing ${file}:`, error.message);
    }
}


