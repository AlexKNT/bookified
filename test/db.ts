import { randomUUID } from "node:crypto";

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach } from "vitest";

/**
 * The database every test runs against: a `mongod` started by the test run
 * itself and thrown away when it ends.
 *
 * This module is a setup file, so it loads before the test file's own imports.
 * That ordering is the safety property: `database/mongoose.ts` reads
 * `MONGODB_URI` once, at module scope, so the throwaway address has to be in
 * place before that module is ever loaded. The address in `.env.local` is
 * never read by a test, which is what lets the suite run on a fresh checkout
 * with no environment file at all.
 *
 * One server is shared by every test file a worker process runs (it is cached
 * on the worker global), while each test file gets its own database, so one
 * file can never see another's documents.
 */

const MONGODB_BINARY_VERSION = "8.2.0";

declare global {
  var __bookifiedMemoryServer: Promise<MongoMemoryServer> | undefined;
}

const startMemoryServer = (): Promise<MongoMemoryServer> => {
  // Cached on the worker global rather than a module variable so a worker that
  // runs several test files starts `mongod` only once.
  global.__bookifiedMemoryServer ??= MongoMemoryServer.create({
    binary: { version: MONGODB_BINARY_VERSION },
  });

  return global.__bookifiedMemoryServer;
};

const server = await startMemoryServer();

const databaseName = `bookified_test_${randomUUID().replaceAll("-", "")}`;

const databaseUri = (() => {
  const uri = new URL(server.getUri());
  uri.pathname = `/${databaseName}`;
  return uri.toString();
})();

// The application code reads this at import time, which is why it is set here
// and not in a hook.
process.env.MONGODB_URI = databaseUri;

// `database/mongoose.ts` memoises its connection on purpose, so hot reloads do
// not open a new pool. A cache left behind by an earlier test file in this
// worker would point at that file's database, so it is cleared before the
// application module loads and builds its own.
global.mongooseCache = undefined;

/**
 * The guard behind AC-4. The override above is the first line of defence; this
 * is the second, and it fails the file rather than letting a query run against
 * whatever the live connection happens to point at.
 */
const assertThrowawayConnection = () => {
  const target = new URL(server.getUri());
  const expectedPort = Number(target.port);
  const { host, port, name } = mongoose.connection;

  if (host !== target.hostname || port !== expectedPort || name !== databaseName) {
    throw new Error(
      `Refusing to run tests against ${host}:${port}/${name}. ` +
        `Expected the throwaway server at ${target.hostname}:${expectedPort}/${databaseName}.`,
    );
  }
};

beforeAll(async () => {
  // `bufferCommands` is false, so a query issued before the connection resolves
  // fails instead of waits. The helper owns the connection, not the test file.
  await mongoose.connect(databaseUri, { bufferCommands: false });
  assertThrowawayConnection();
});

beforeEach(async () => {
  // Emptied between tests so test order can never matter.
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})),
  );
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});
