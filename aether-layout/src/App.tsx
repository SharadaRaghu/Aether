import React, { useState, useCallback } from 'react';
import { supabase } from './Supabase';
import RoomScene from './Room/RoomScene';
import { type LayoutItem } from './Types/LayoutItem';
import {
  Box,
  TextField,
  Button,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Stack,
} from '@mui/material';

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [dimensions, setDimensions] = useState({ width: 5, depth: 5 });
  const [layout, setLayout] = useState<LayoutItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItemName, setSelectedItemName] = useState<string | null>(null);

  const handle3DUpdate = useCallback((name: string, x: number, z: number, rotation: number) => {
    setLayout((prev) =>
      prev.map((item) =>
        item.name === name ? { ...item, x, z, rotation } : item
      )
    );
  }, []);

  const generateLayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME;
      const { data, error: functionError } = await supabase.functions.invoke(functionName, {
        body: { prompt, roomSize: dimensions },
      });

      if (functionError) throw new Error(functionError.message);
      setLayout(data || []);
      setSelectedItemName(null); 
    } catch (err: any) {
      setError(err.message || "Failed to generate layout.");
    } finally {
      setIsLoading(false);
    }
  };

  const rotateSelected = (direction: 'left' | 'right') => {
    if (!selectedItemName) return;
    const rotationAmount = Math.PI / 4;
    setLayout(layout.map(item => {
      if (item.name === selectedItemName) {
        const newRotation = direction === 'left' ? item.rotation + rotationAmount : item.rotation - rotationAmount;
        return { ...item, rotation: newRotation };
      }
      return item;
    }));
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', position: 'fixed', top: 0, left: 0 }}>
      
      {/* Sidebar */}
      <Box sx={{ width: '380px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', height: '100vh' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'white', mb: '8px' }}>🛋️ Aether</Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>Visualize Before You Furnish</Typography>
        </Box>

        <Paper component="form" onSubmit={generateLayout} sx={{ padding: '20px', background: 'rgba(255,255,255,0.95)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: '8px', color: '#333' }}>Room Dimensions</Typography>
            <Box sx={{ display: 'flex', gap: '12px' }}>
              <TextField label="Width (m)" type="number" value={dimensions.width} onChange={(e) => setDimensions({ ...dimensions, width: Number(e.target.value) })} fullWidth size="small" disabled={isLoading} />
              <TextField label="Depth (m)" type="number" value={dimensions.depth} onChange={(e) => setDimensions({ ...dimensions, depth: Number(e.target.value) })} fullWidth size="small" disabled={isLoading} />
            </Box>
          </Box>

          <TextField label="Describe Your Room" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="E.g., Modern minimalist office..." multiline rows={4} fullWidth disabled={isLoading} />

          <Button type="submit" variant="contained" disabled={isLoading || !prompt.trim()} sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontWeight: 'bold' }}>
            {isLoading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Generate Layout'}
          </Button>
          {error && <Alert severity="error">{error}</Alert>}
        </Paper>

        <Paper sx={{ padding: '16px', background: 'rgba(255,255,255,0.95)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#333' }}>Model Controls</Typography>
          <Typography variant="caption" sx={{ color: '#666' }}>Selected: <strong>{selectedItemName || 'None'}</strong></Typography>
          <Stack direction="row" spacing={1}>
            <Button onClick={() => rotateSelected('left')} disabled={!selectedItemName} variant="outlined" fullWidth size="small">⟲ Rotate L</Button>
            <Button onClick={() => rotateSelected('right')} disabled={!selectedItemName} variant="outlined" fullWidth size="small">Rotate R ⟳</Button>
          </Stack>
        </Paper>

        <Paper sx={{ padding: '16px', background: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>💡 How to Use</Typography>
          <Typography variant="caption" display="block">Click floor to deselect</Typography>
          <Typography variant="caption" display="block">Drag models to move</Typography>
        </Paper>
      </Box>

      {/* 3D Scene */}
      <Box sx={{ flex: 1, background: '#1a1a1a' }}>
        <RoomScene 
          layout={layout} 
          width={dimensions.width} 
          depth={dimensions.depth}
          onSelectModel={setSelectedItemName}
          selectedModel={selectedItemName}
          onUpdate={handle3DUpdate}
        />
      </Box>
    </Box>
  );
}