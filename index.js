const { Sequelize } = require('sequelize');
const chalk = require('chalk');
const fs = require('fs');

const user = 'root';
const password = '1234';
const host = 'localhost';
const db1Name = 'kurabun';
const db2Name = 'kurabun_v1';

const sequelize1 = new Sequelize(db1Name, user, password, {
    host: host,
    dialect: 'mysql'
});

const sequelize2 = new Sequelize(db2Name, user, password, {
    host: host,
    dialect: 'mysql'
});

async function getTables(sequelize) {
    const query = "SHOW TABLES;";
    const [results] = await sequelize.query(query);
    return results.map(row => Object.values(row)[0]);
}

async function getTableData(sequelize, table) {
    const query = `SELECT * FROM \`${table}\``;
    const [rows] = await sequelize.query(query);
    return rows;
}

function compareRows(rows1, rows2) {
    const differences = [];
    const maxLength = Math.max(rows1.length, rows2.length);

    for (let i = 0; i < maxLength; i++) {
        const row1 = rows1[i] || {};
        const row2 = rows2[i] || {};

        for (const key in row1) {
            // Bỏ qua không cần so sánh các trường 'created_at' và 'updated_at'
            if (key === 'createdAt' || key === 'updatedAt') {
                continue;
            }
            if (row1[key] !== row2[key]) {
                differences.push({
                    index: i,
                    column: key,
                    value1: row1[key],
                    value2: row2[key]
                });
            }
        }
    }
    return differences;
}

async function generateHTMLReport(differencesReport) {
    let htmlContent = `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Báo cáo So sánh Dữ liệu</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
                th, td { border: 1px solid #dddddd; text-align: left; padding: 8px; }
                th { background-color: #f2f2f2; }
                .diff { background-color: #f8d7da; }
                .no-diff { background-color: #d4edda; }
            </style>
        </head>
        <body>
            <h1>Báo cáo So sánh Dữ liệu</h1>
    `;

    differencesReport.forEach(table => {
        htmlContent += `<h2>Bảng: ${table.tableName}</h2>`;
        htmlContent += `<table><tr><th>Chỉ số</th><th>Cột</th><th>Giá trị Cơ sở dữ liệu 1</th><th>Giá trị Cơ sở dữ liệu 2</th></tr>`;
        
        if (table.differences.length > 0) {
            table.differences.forEach(diff => {
                htmlContent += `<tr class="diff"><td>${diff.index}</td><td>${diff.column}</td><td>${diff.value1}</td><td>${diff.value2}</td></tr>`;
            });
        } else {
            htmlContent += `<tr><td colspan="4" class="no-diff">Không có sự khác biệt trong bảng này.</td></tr>`;
        }
        htmlContent += `</table>`;
    });

    htmlContent += `
        </body>
        </html>
    `;

    fs.writeFileSync('comparison_report-v2.html', htmlContent);
}

async function compareDatabases() {
    const tables1 = await getTables(sequelize1);
    const tables2 = await getTables(sequelize2);
    const differencesReport = [];

    for (const table of tables1) {
        if (tables2.includes(table)) {
            const rows1 = await getTableData(sequelize1, table);
            const rows2 = await getTableData(sequelize2, table);

            const differences = compareRows(rows1, rows2);
            differencesReport.push({ tableName: table, differences });
        } else {
            console.log(chalk.cyan(`Table '${table}' exists in the first database but not in the second.`));
        }
    }

    for (const table of tables2) {
        if (!tables1.includes(table)) {
            console.log(chalk.magenta(`Table '${table}' exists in the second database but not in the first.`));
        }
    }

    await generateHTMLReport(differencesReport);
}


compareDatabases()
    .then(() => {
        sequelize1.close();
        sequelize2.close();
        console.log(chalk.green('Báo cáo so sánh đã được tạo thành công: comparison_report.html'));
    })
    .catch(error => {
        console.error(chalk.red(`Error: ${error.message}`));
    });
