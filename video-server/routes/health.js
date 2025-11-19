import { Route } from 'owebjs';
import { getNow, formatDate } from '../utils/timezone.js';
import mongoose from 'mongoose';
import { initializeB2 } from '../utils/backblaze.js';

export default class extends Route {
  async handle(req, reply) {
    const checks = {
      mongodb: { status: 'unknown', message: '' },
      backblaze: { status: 'unknown', message: '' }
    };

    let overallStatus = 'OK';

    try {
      const mongoState = mongoose.connection.readyState;
      const states = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
      };
      
      if (mongoState === 1) {
        checks.mongodb.status = 'healthy';
        checks.mongodb.message = 'Connected';
      } else {
        checks.mongodb.status = 'unhealthy';
        checks.mongodb.message = `State: ${states[mongoState] || 'unknown'}`;
        overallStatus = 'DEGRADED';
      }
    } catch (error) {
      checks.mongodb.status = 'error';
      checks.mongodb.message = error.message;
      overallStatus = 'DEGRADED';
    }

    try {
      const { b2, auth } = await initializeB2();
      if (auth && auth.data) {
        checks.backblaze.status = 'healthy';
        checks.backblaze.message = 'Connected and authorized';
      } else {
        checks.backblaze.status = 'unhealthy';
        checks.backblaze.message = 'Authorization incomplete';
        overallStatus = 'DEGRADED';
      }
    } catch (error) {
      checks.backblaze.status = 'error';
      checks.backblaze.message = error.message;
      overallStatus = 'DEGRADED';
    }

    return reply.send({ 
      status: overallStatus,
      timestamp: getNow(),
      formatted: formatDate(getNow()),
      checks
    });
  }
}

