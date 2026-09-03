import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.json());

// Persistent storage setup
const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "asd_database.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial seed data for ASD calculation projects
const initialDatabase = {
  projects: [
    {
      id: "proj-1",
      code: "ASD-2026-001",
      title: "Data Center Alpha - Server Hall 1A",
      clientName: "PT Nusantara Cloud Solutions",
      clientContact: "engineering@nusantaracloud.id",
      facilityName: "Cyber Green Building, Jakarta",
      location: "Jakarta, Indonesia",
      status: "approved",
      createdAt: Date.now() - 86400000 * 3,
      updatedAt: Date.now() - 3600000 * 4,
      updatedBy: "Andi Saputra, ST (Lead Fire Specialist)",
      activeScenarioId: "scen-1",
    },
    {
      id: "proj-2",
      code: "ASD-2026-002",
      title: "Cleanroom ISO Class 5 Pharmaceutical",
      clientName: "BioFarma Nusantara Corp",
      clientContact: "qa.safety@biofarma.co.id",
      facilityName: "Bandung Life Science Campus",
      location: "Bandung, West Java",
      status: "review",
      createdAt: Date.now() - 86400000 * 1,
      updatedAt: Date.now() - 3600000 * 2,
      updatedBy: "Budi Hartono (Fire Systems Engineer)",
      activeScenarioId: "scen-2",
    },
    {
      id: "proj-3",
      code: "ASD-2026-003",
      title: "High-Bay Distribution Warehouse",
      clientName: "Logistik Global Raya",
      clientContact: "ops@logistikglobal.com",
      facilityName: "Central Hub Cikarang",
      location: "Bekasi, West Java",
      status: "draft",
      createdAt: Date.now() - 3600000 * 5,
      updatedAt: Date.now() - 1800000,
      updatedBy: "User (You)",
      activeScenarioId: "scen-3",
    },
  ],
  scenarios: [
    {
      id: "scen-1",
      projectId: "proj-1",
      name: "Option A: 4-Pipe High Sensitivity Grid",
      revision: "Rev 2.0 (Approved)",
      createdAt: Date.now() - 86400000 * 2,
      updatedAt: Date.now() - 3600000 * 4,
      params: {
        length: 24,
        width: 16,
        height: 3.8,
        ceilingType: "suspended_grid",
        ceilingPitchDegrees: 0,
        roomType: "data_center",
        airChangesPerHour: 28,
        airflowVelocity: 2.2,
        sensitivityClass: "Class A (High Sensitivity)",
        detectorModel: "VESDA VEP-A00-P (4-Pipe)",
        pipeCount: 4,
        aspiratorSpeed: "high",
        detectorLocation: { wall: "west", positionOffsetRatio: 0.5, heightFromFloor: 1.5 },
        layoutTopology: "linear",
        pipeRunOrientation: "lengthwise",
        pipeSpacingMeters: 4.0,
        holeSpacingMeters: 4.0,
        pipeMaterial: 'CPVC Red Fire Alarm 25mm (3/4")',
        capillaryDropEnabled: true,
        capillaryTubeLength: 0.8,
      },
    },
    {
      id: "scen-2",
      projectId: "proj-2",
      name: "Standard Cleanroom 2-Pipe U-Return",
      revision: "Rev 1.0",
      createdAt: Date.now() - 86400000 * 1,
      updatedAt: Date.now() - 3600000 * 2,
      params: {
        length: 18,
        width: 12,
        height: 3.2,
        ceilingType: "flat",
        ceilingPitchDegrees: 0,
        roomType: "clean_room",
        airChangesPerHour: 20,
        airflowVelocity: 1.5,
        sensitivityClass: "Class A (High Sensitivity)",
        detectorModel: "Securiton ASD 535 (2-Pipe)",
        pipeCount: 2,
        aspiratorSpeed: "high",
        detectorLocation: { wall: "south", positionOffsetRatio: 0.5, heightFromFloor: 1.5 },
        layoutTopology: "linear",
        pipeRunOrientation: "lengthwise",
        pipeSpacingMeters: 6.0,
        holeSpacingMeters: 4.5,
        pipeMaterial: 'ABS Red 25mm',
        capillaryDropEnabled: false,
        capillaryTubeLength: 0,
      },
    },
    {
      id: "scen-3",
      projectId: "proj-3",
      name: "High-Bay Warehouse 4-Pipe Branch",
      revision: "Draft 0.1",
      createdAt: Date.now() - 3600000 * 5,
      updatedAt: Date.now() - 1800000,
      params: {
        length: 36,
        width: 24,
        height: 8.5,
        ceilingType: "open_beam",
        ceilingPitchDegrees: 5,
        roomType: "warehouse",
        airChangesPerHour: 4,
        airflowVelocity: 0.3,
        sensitivityClass: "Class B (Enhanced)",
        detectorModel: "VESDA VEU-A00 (High-Sensitivity 4-Pipe)",
        pipeCount: 4,
        aspiratorSpeed: "high",
        detectorLocation: { wall: "north", positionOffsetRatio: 0.3, heightFromFloor: 2.0 },
        layoutTopology: "linear",
        pipeRunOrientation: "lengthwise",
        pipeSpacingMeters: 6.0,
        holeSpacingMeters: 6.0,
        pipeMaterial: 'CPVC Red Fire Alarm 25mm (3/4")',
        capillaryDropEnabled: false,
        capillaryTubeLength: 0,
      },
    },
  ],
  activities: [
    {
      id: "act-1",
      projectId: "proj-1",
      userId: "user-andi",
      userName: "Andi Saputra, ST",
      action: "Approve Design",
      details: "Approved NFPA 72 calculation for Data Center Alpha (Transport Time: 48s, Balance: 84%)",
      timestamp: Date.now() - 3600000 * 4,
    },
    {
      id: "act-2",
      projectId: "proj-2",
      userId: "user-budi",
      userName: "Budi Hartono",
      action: "Update Scenario",
      details: "Optimized sampling hole sizes for Cleanroom ISO 5 to satisfy 60s Class A transport limit",
      timestamp: Date.now() - 3600000 * 2,
    },
  ],
};

function readDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error("Error reading database file:", err);
  }
  // If missing or corrupted, write initial
  fs.writeFileSync(DB_FILE, JSON.stringify(initialDatabase, null, 2), "utf-8");
  return initialDatabase;
}

function saveDatabase(data: typeof initialDatabase) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing database file:", err);
  }
}

// WebSocket setup for real-time collaboration
const wss = new WebSocketServer({ server });
const connectedClients = new Set<WebSocket>();

interface WSMessage {
  type: string;
  payload: any;
  sender?: string;
}

function broadcast(msg: WSMessage, excludeWs?: WebSocket) {
  const data = JSON.stringify(msg);
  connectedClients.forEach((client) => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

wss.on("connection", (ws) => {
  connectedClients.add(ws);

  // Send current presence count
  ws.send(
    JSON.stringify({
      type: "init:connected",
      payload: {
        onlineCount: connectedClients.size,
        timestamp: Date.now(),
      },
    })
  );

  // Broadcast user count update
  broadcast({
    type: "presence:update",
    payload: {
      onlineCount: connectedClients.size,
    },
  });

  ws.on("message", (raw) => {
    try {
      const msg: WSMessage = JSON.parse(raw.toString());
      if (msg.type === "calculation:update") {
        // Forward real-time parameter changes to other team members
        broadcast(msg, ws);
      } else if (msg.type === "presence:ping") {
        ws.send(JSON.stringify({ type: "presence:pong", timestamp: Date.now() }));
      }
    } catch (e) {
      console.error("WS parse error:", e);
    }
  });

  ws.on("close", () => {
    connectedClients.delete(ws);
    broadcast({
      type: "presence:update",
      payload: {
        onlineCount: connectedClients.size,
      },
    });
  });
});

// REST APIs
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now(), activeSockets: connectedClients.size });
});

// Get all projects
app.get("/api/projects", (req, res) => {
  const db = readDatabase();
  res.json(db.projects);
});

// Create project
app.post("/api/projects", (req, res) => {
  const db = readDatabase();
  const newProj = {
    id: `proj-${Date.now()}`,
    code: req.body.code || `ASD-${new Date().getFullYear()}-${String(db.projects.length + 1).padStart(3, "0")}`,
    title: req.body.title || "Untitled ASD Project",
    clientName: req.body.clientName || "General Client",
    clientContact: req.body.clientContact || "",
    facilityName: req.body.facilityName || "Facility Room",
    location: req.body.location || "Indonesia",
    status: req.body.status || "draft",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    updatedBy: req.body.author || "User (You)",
    activeScenarioId: "",
  };

  // Create default scenario
  const defaultScenario = {
    id: `scen-${Date.now()}`,
    projectId: newProj.id,
    name: "Base Design Calculation",
    revision: "Rev 1.0",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    params: req.body.params || {
      length: 20,
      width: 14,
      height: 3.5,
      ceilingType: "flat",
      ceilingPitchDegrees: 0,
      roomType: "general_commercial",
      airChangesPerHour: 6,
      airflowVelocity: 0.5,
      sensitivityClass: "Class C (Standard)",
      detectorModel: "VESDA VEP-A00-P (4-Pipe)",
      pipeCount: 2,
      aspiratorSpeed: "high",
      detectorLocation: { wall: "west", positionOffsetRatio: 0.5, heightFromFloor: 1.5 },
      layoutTopology: "linear",
      pipeRunOrientation: "lengthwise",
      pipeSpacingMeters: 5.0,
      holeSpacingMeters: 5.0,
      pipeMaterial: 'CPVC Red Fire Alarm 25mm (3/4")',
      capillaryDropEnabled: false,
      capillaryTubeLength: 0,
    },
  };

  newProj.activeScenarioId = defaultScenario.id;
  db.projects.unshift(newProj);
  db.scenarios.unshift(defaultScenario);

  const newActivity = {
    id: `act-${Date.now()}`,
    projectId: newProj.id,
    userId: "user-current",
    userName: req.body.author || "User (You)",
    action: "Create Project",
    details: `Created new project "${newProj.title}" with default NFPA 72 calculation`,
    timestamp: Date.now(),
  };
  db.activities.unshift(newActivity);

  saveDatabase(db);

  // Broadcast to all connected clients
  broadcast({
    type: "project:created",
    payload: { project: newProj, scenario: defaultScenario, activity: newActivity },
  });

  res.status(201).json({ project: newProj, scenario: defaultScenario });
});

// Update project
app.put("/api/projects/:id", (req, res) => {
  const db = readDatabase();
  const index = db.projects.findIndex((p: any) => p.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const updatedProj = {
    ...db.projects[index],
    ...req.body,
    updatedAt: Date.now(),
  };
  db.projects[index] = updatedProj;

  const newActivity = {
    id: `act-${Date.now()}`,
    projectId: updatedProj.id,
    userId: "user-current",
    userName: req.body.updatedBy || "User (You)",
    action: req.body.statusChange ? `Status Changed to ${updatedProj.status}` : "Update Project Details",
    details: req.body.changeDescription || `Updated details for ${updatedProj.title}`,
    timestamp: Date.now(),
  };
  db.activities.unshift(newActivity);

  saveDatabase(db);

  broadcast({
    type: "project:updated",
    payload: { project: updatedProj, activity: newActivity },
  });

  res.json({ project: updatedProj });
});

// Delete project
app.delete("/api/projects/:id", (req, res) => {
  const db = readDatabase();
  const id = req.params.id;
  db.projects = db.projects.filter((p: any) => p.id !== id);
  db.scenarios = db.scenarios.filter((s: any) => s.projectId !== id);
  db.activities = db.activities.filter((a: any) => a.projectId !== id);
  saveDatabase(db);

  broadcast({
    type: "project:deleted",
    payload: { projectId: id },
  });

  res.json({ success: true, id });
});

// Get scenarios for project
app.get("/api/projects/:id/scenarios", (req, res) => {
  const db = readDatabase();
  const scenarios = db.scenarios.filter((s: any) => s.projectId === req.params.id);
  res.json(scenarios);
});

// Save / update scenario
app.post("/api/projects/:id/scenarios", (req, res) => {
  const db = readDatabase();
  const projectId = req.params.id;
  const { id, name, revision, params, author } = req.body;

  let savedScenario: any;
  if (id) {
    const sIndex = db.scenarios.findIndex((s: any) => s.id === id);
    if (sIndex !== -1) {
      savedScenario = {
        ...db.scenarios[sIndex],
        name: name || db.scenarios[sIndex].name,
        revision: revision || db.scenarios[sIndex].revision,
        params: params || db.scenarios[sIndex].params,
        updatedAt: Date.now(),
      };
      db.scenarios[sIndex] = savedScenario;
    }
  }

  if (!savedScenario) {
    savedScenario = {
      id: `scen-${Date.now()}`,
      projectId,
      name: name || "Scenario " + (db.scenarios.filter((s: any) => s.projectId === projectId).length + 1),
      revision: revision || "Rev 1.0",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      params,
    };
    db.scenarios.push(savedScenario);
  }

  // Update project updated time
  const pIndex = db.projects.findIndex((p: any) => p.id === projectId);
  if (pIndex !== -1) {
    db.projects[pIndex].updatedAt = Date.now();
    db.projects[pIndex].activeScenarioId = savedScenario.id;
    db.projects[pIndex].updatedBy = author || "User (You)";
  }

  const newActivity = {
    id: `act-${Date.now()}`,
    projectId,
    userId: "user-current",
    userName: author || "User (You)",
    action: "Save Calculation",
    details: `Updated calculation scenario "${savedScenario.name}" (${savedScenario.revision})`,
    timestamp: Date.now(),
  };
  db.activities.unshift(newActivity);

  saveDatabase(db);

  broadcast({
    type: "scenario:saved",
    payload: { scenario: savedScenario, activity: newActivity, project: db.projects[pIndex] },
  });

  res.json({ scenario: savedScenario });
});

// Get activities log
app.get("/api/activities", (req, res) => {
  const db = readDatabase();
  res.json(db.activities.slice(0, 30));
});

// Vite middleware in dev or static serve in prod
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`ASD Calculator server running at http://0.0.0.0:${PORT}`);
  });
}

start();
