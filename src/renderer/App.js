import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
const App = () => {
    const [pingResponse, setPingResponse] = useState('');
    const handlePing = async () => {
        try {
            const response = await window.api.system.ping();
            setPingResponse(response);
        }
        catch (error) {
            console.error('Ping failed:', error);
            setPingResponse('Error: Failed to ping main process');
        }
    };
    return (_jsxs("div", { style: { padding: '20px', fontFamily: 'sans-serif' }, children: [_jsx("h1", { children: "Chat2Data" }), _jsx("p", { children: "Electron + React + TypeScript + Vite Setup Complete!" }), _jsx("button", { onClick: handlePing, style: { marginTop: '10px', padding: '8px 16px', cursor: 'pointer' }, children: "Ping Main Process" }), pingResponse && (_jsxs("p", { style: { marginTop: '10px', color: 'green', fontWeight: 'bold' }, children: ["Response: ", pingResponse] }))] }));
};
export default App;
