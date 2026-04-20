const { Client } = require('pg');

const connectionString = 'postgresql://unqmuz_umid:u%2CDmLhqKf!n.v%3D~L@127.0.0.200:5432/unqmuz_DB?schema=public';

async function runMigration() {
    const client = new Client({
        connectionString,
    });

    try {
        await client.connect();
        console.log('Connected to database');

        const query = `
      ALTER TYPE "WaiterTaskType"
      ADD VALUE IF NOT EXISTS 'guest_order';
    `;

        await client.query(query);
        console.log('Migration executed successfully');

    } catch (err) {
        console.error('Error executing query:', err);
    } finally {
        await client.end();
        console.log('Connection closed');
    }
}

runMigration();