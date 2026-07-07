/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { dbManager } from './server_db';
import { getAiSchedulePlot, getAiDashboardSummary, isGeminiConfigured } from './server_ai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API Routes ---

  // Get current state / status of the system
  app.get('/api/status', (req, res) => {
    res.json({
      supabase: dbManager.isSupabaseConnected(),
      gemini: isGeminiConfigured()
    });
  });

  // App users endpoint
  app.get('/api/app_users', async (req, res) => {
    try {
      const users = await dbManager.getAppUsers();
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Manpower endpoints
  app.get('/api/manpower', async (req, res) => {
    try {
      const manpower = await dbManager.getManpower();
      res.json(manpower);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Units endpoints
  app.get('/api/units', async (req, res) => {
    try {
      const units = await dbManager.getUnits();
      res.json(units);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Schedules endpoints
  app.get('/api/schedules', async (req, res) => {
    try {
      const schedules = await dbManager.getSchedules();
      res.json(schedules);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/schedules', async (req, res) => {
    try {
      const newSchedule = await dbManager.addSchedule(req.body);
      res.status(201).json(newSchedule);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/schedules/:id', async (req, res) => {
    try {
      const updated = await dbManager.updateSchedule(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Schedule not found' });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/schedules/:id', async (req, res) => {
    try {
      const success = await dbManager.deleteSchedule(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Schedule not found' });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // AI-Powered Sudden Schedule Plotter endpoint
  app.post('/api/ai-plotter', async (req, res) => {
    try {
      const { client_name, pic_name, start_date, end_date, unit_ids, priority } = req.body;
      if (!start_date || !end_date || !unit_ids || unit_ids.length === 0) {
        return res.status(400).json({ error: 'Missing required parameters: start_date, end_date, unit_ids' });
      }

      // Fetch the full database state to pass to Gemini
      const dbState = await dbManager.getFullState();

      // Get recommended plot
      const plotRecommendation = await getAiSchedulePlot({
        client_name: client_name || 'Sudden Inspection',
        pic_name: pic_name || 'Operational PIC',
        start_date,
        end_date,
        unit_ids,
        priority: priority || 'P1'
      }, dbState);

      res.json(plotRecommendation);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // AI Daily/Weekly Summary endpoint
  app.get('/api/ai-summary', async (req, res) => {
    try {
      const dbState = await dbManager.getFullState();
      const summary = await getAiDashboardSummary(dbState);
      res.json({ summary });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Serve Frontend ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
