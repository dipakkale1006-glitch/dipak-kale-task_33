'use strict';

/**
 * Seeds the database with a handful of sample tasks.
 *
 * Useful for demos, screenshots and manual Postman testing:
 *   npm run seed
 *
 * Run with `--reset` to wipe existing tasks first:
 *   npm run seed -- --reset
 */

const mongoose = require('mongoose');

const env = require('../config/env');
const { connectDatabase, disconnectDatabase } = require('../config/database');
const Task = require('../models/Task');
const logger = require('../utils/logger');

const dayFromNow = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

const SAMPLE_TASKS = [
  {
    title: 'Complete MERN assignment documentation',
    description: 'Write the README covering setup, environment variables and deployment.',
    priority: 'high',
    category: 'study',
    dueDate: dayFromNow(2),
    completed: false,
  },
  {
    title: 'Revise Express middleware',
    description: 'Error handling, validation and the routes -> controller -> service layering.',
    priority: 'medium',
    category: 'study',
    dueDate: dayFromNow(5),
    completed: false,
  },
  {
    title: 'Buy groceries for the week',
    description: 'Milk, eggs, vegetables and coffee.',
    priority: 'low',
    category: 'personal',
    dueDate: dayFromNow(-1),
    completed: false,
  },
  {
    title: 'Publish the repository on GitHub',
    description: 'Push the backend and the React frontend, then link both in the README.',
    priority: 'high',
    category: 'work',
    dueDate: dayFromNow(1),
    completed: true,
  },
  {
    title: 'Deploy the API to Render',
    description: 'Set MONGODB_URI and CORS_ORIGIN in the dashboard and verify /api/health.',
    priority: 'medium',
    category: 'work',
    dueDate: null,
    completed: false,
  },
];

async function seed() {
  const reset = process.argv.includes('--reset');

  await connectDatabase();
  logger.info(`Connected to ${env.mongodbUri}`);

  if (reset) {
    const deleted = await Task.deleteMany({});
    logger.info(`Reset: removed ${deleted.deletedCount} existing task(s)`);
  }

  const created = await Task.insertMany(SAMPLE_TASKS);
  logger.info(`Inserted ${created.length} sample task(s)`);

  await disconnectDatabase();
  logger.info('Seed complete');
}

seed()
  .then(() => process.exit(0))
  .catch(async (error) => {
    logger.error(`Seeding failed: ${error.message}`);
    await disconnectDatabase().catch(() => {});
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
