# 🛋️ Aether Layout

**Transform your space with AI-powered interior design.**

Aether Layout is an intelligent 3D room planner that intelligently arranges furniture within your exact room dimensions. Define your space (office, bedroom, living room), describe your style and needs, and watch AI generate optimized layouts—no design experience required.

## The Problem It Solves

 **For Office Managers & Teams:**
- Visualize how your office dimensions will look with furniture before ordering
- Optimize workspace layouts for productivity and ergonomics
- Identify spatial conflicts (furniture overlaps, blocked pathways) before costly mistakes

 **For Homeowners & Renters:**
- Plan room layouts before moving furniture (saves time and back pain!)
- Try multiple design options instantly
- Understand spatial flow and room aesthetics in 3D
- Make good furniture purchasing decisions

 **For Interior Designers & Real Estate:**
- Present multiple layout options to clients in 3D
- Speed up design iteration cycles
- Leverage AI suggestions while maintaining creative control
- Generate client-ready visualizations instantly

## Key Innovation

Unlike generic 3D planners, Aether:
- Respects exact room boundaries (no furniture clipping through walls)
- Matches furniture to your described style
- Prevents overlapping items using real furniture dimensions
- Generates layouts optimized for your specific room size

## Example Use Cases

**Case 1: Small Home Office**
```
Room: 3.5m × 4m
Input: "Compact casual space with desk, chair, and storage"
Output: AI-optimized layout showing desk positioned for natural light, 
        ergonomic chair placement, and bookshelf in corner
Result: Order furniture with confidence knowing exactly how it fits
```

**Case 2: Apartment Redesign**
```
Room: 5m × 6m
Input: "Home office for freelancer with desk, ergonomic chair and tall plant"
Output: Multiple layout suggestions showing different furniture arrangements
Result: Visualize options before committing to new furniture purchases
```

## Features

**AI-Driven Design**
- Describe your room vibe, and let AI generate optimized furniture layouts
- Powered by Google Gemini 1.5 Flash for intelligent spatial planning
- Smart category-based furniture matching (strict category constraints)

**Interactive 3D Visualization**
- Real-time 3D room preview with Three.js and React Three Fiber
- Drag-and-drop furniture positioning
- 45° incremental rotation controls
- Automatic boundary clamping (furniture stays within room)
- Selection highlighting with cyan outlines

**Intuitive Controls**
- **Click** models to select them
- **Drag** to reposition furniture
- **Rotate Left/Right** buttons for precise rotation
- **Middle mouse** for camera pan/orbit
- Real-time updates and visual feedback

**Custom Room Dimensions**
- Adjustable width and depth (in meters)
- Dynamic camera positioning based on room size
- Grid-based floor with visual boundaries

## Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- Material-UI (component library)
- Three.js + React Three Fiber (3D rendering)
- @react-three/drei (3D utilities)

**Backend:**
- Supabase Edge Functions (Deno runtime)
- Google Gemini 2.5 Flash API
- Supabase Storage S3 (GLB model hosting)

**Database:**
- Supabase PostgreSQL (inventory management)

## Getting Started

### Prerequisites
- Node.js 16+ and npm
- Supabase account
- Google Cloud API key (Gemini)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/SharadaRaghu/aether-layout.git
   cd aether-layout
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the project root:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_SUPABASE_FUNCTION_NAME=quick-task
   ```

4. **Configure Supabase**

   a. Create an `inventory` table with the following schema:
   ```sql
   CREATE TABLE inventory (
     id BIGSERIAL PRIMARY KEY,
     name TEXT NOT NULL,
     category TEXT NOT NULL,
     description TEXT,
     model_url TEXT NOT NULL,
     width_m DECIMAL(5,2),
     depth_m DECIMAL(5,2),
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

   b. Create a `models` storage bucket and upload your GLB files:
      - Make the bucket public
      - Enable CORS for your domain

   c. Deploy the Edge Function (see [Edge Function Setup](#edge-function-setup))

5. **Start the dev server**
   ```bash
   npm run dev
   ```
   
   Open [http://localhost:PORT](http://localhost:PORT)

## Edge Function Setup

### Create the Function

In Supabase Dashboard → Edge Functions → Create New:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt, roomSize } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: dbItems } = await supabase
      .from('inventory')
      .select('name, category, description, model_url, width_m, depth_m');

    const systemInstruction = `
      You are an Expert Interior AI Architect.
      Room Size: ${roomSize.width}m x ${roomSize.depth}m
      Center: (0,0). Bounds: X from -${roomSize.width/2} to ${roomSize.width/2}, Z from -${roomSize.depth/2} to ${roomSize.depth/2}

      AVAILABLE INVENTORY:
      ${JSON.stringify(dbItems)}

      INSTRUCTIONS:
      1. Analyze user request for mood, style, functionality
      2. Match vibe using description/category/name fields
      3. STRICT CATEGORY FILTERING: Prioritize category as hard constraint
      4. Spatial Planning: Keep items within bounds, use width_m/depth_m for overlap prevention
      5. Rotation in radians (0-6.28)

      OUTPUT: ONLY valid JSON array (no markdown):
      [{"name": string, "model_url": string, "x": number, "z": number, "rotation": number}]
    `;

    const apiKey = Deno.env.get('GEMINI_API_KEY')

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemInstruction + "\n\nUser Request: " + prompt }] }],
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          ],
          generationConfig: { temperature: 0.7 }
        })
      }
    )

    const data = await response.json()
    
    if (!data.candidates?.length) {
      throw new Error(`Gemini Error: ${data.promptFeedback?.blockReason || "No response"}`)
    }

    let layoutText = data.candidates[0].content.parts[0].text.trim()
    if (layoutText.startsWith("```json")) {
      layoutText = layoutText.replace(/```json|```/g, "").trim()
    }

    let layout = JSON.parse(layoutText)
    layout = layout.map((item: any) => {
      const matched = dbItems.find((inv: any) => inv.model_url === item.model_url)
      return {
        ...item,
        width_m: matched?.width_m || 1,
        depth_m: matched?.depth_m || 1
      }
    })

    return new Response(JSON.stringify(layout), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("Error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
```

### Set Secrets

In Supabase Dashboard → Function Secrets, add:
- `GEMINI_API_KEY` - Get from [Google Cloud Console](https://console.cloud.google.com/)
- `SUPABASE_URL` - Your project URL
- `SUPABASE_SERVICE_ROLE_KEY` - From Settings → API

## Usage

### 1. Define Room Dimensions
Enter width and depth in meters (e.g., 5m × 5m)

### 2. Describe Your Room
```
A simple office space with a ikea desk and a ergonomic chair with a tall potted plant on the side.
```

### 3. Generate Layout
Click **"Generate Layout"** lets AI create an optimized arrangement

### 4. Interact with Models
- **Click** a piece of furniture to select it (cyan outline appears)
- **Drag** to move it around the room (auto-clamps at boundaries)
- **Rotate Left/Right** buttons to rotate in 45° increments
- **Middle mouse + drag** to orbit/pan the camera

### 5. Iterate
Adjust dimensions or description and regenerate for different layouts

## Project Structure

```
src/
├── App.tsx              # Main app component with form & controls
├── Room/
│   └── RoomScene.tsx    # 3D room canvas & furniture rendering
├── Types/
│   └── LayoutItem.ts    # TypeScript interface for furniture items
├── Supabase.ts          # Supabase client setup
├── main.tsx             # React entry point
└── index.css            # Global styles
```

## Key Components

### `RoomScene.tsx`
- Renders Three.js canvas with room floor, grid, and furniture
- Handles drag-and-drop positioning
- Manages model selection and highlighting
- Auto-scales GLB models based on inventory dimensions

### `App.tsx`
- Material-UI sidebar with room form and controls
- Manages layout generation workflow
- Tracks selected model for rotation control
- Displays errors and loading states

## Performance Tips

- **Model Size**: Keep GLB files < 5MB (use compression tools like Draco)
- **Inventory Count**: Optimal with 20-50 furniture items
- **Room Size**: Works best with 3m-10m dimensions
- **GPU**: Recommended for smooth 3D interactions

## Customization

### Change Rotation Increment
In `App.tsx`, modify `rotationAmount`:
```typescript
const rotationAmount = Math.PI / 6; 
```

### Adjust Model Scaling
In `RoomScene.tsx`, change scale bounds:
```typescript
const MIN_SCALE = 0.001;  
const MAX_SCALE = 5;      
```

### Styling
- Sidebar color: Change `background: 'linear-gradient(...'` in `App.tsx`
- 3D environment: Adjust `<Environment preset="city" />` in `RoomScene.tsx`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Models don't appear | Check GLB URLs in console, verify Supabase storage bucket is public |
| Selection not working | Clear browser cache, check RoomScene props are passed correctly |
| Rotation doesn't sync | Ensure `layout` state updates propagate to RoomScene |
| Models appear tiny | Verify `width_m` and `depth_m` in inventory table are realistic |
| CORS errors | Enable CORS on Supabase storage bucket, check function headers |

## Future Enhancements

- Save/load layout designs
- Material and color customization
- Multiplayer collaboration
- Undo/redo functionality
- Room templates library

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License — see LICENSE file for details.

## Support

For issues, questions, or feature requests:
- Open an issue on [GitHub](https://github.com/SharadaRaghu/aether-layout/issues)
- Check existing issues first

## Acknowledgments

- **Google Gemini API** for intelligent layout generation
- **Supabase** for backend infrastructure
- **Three.js & React Three Fiber** for 3D rendering
- **Material-UI** for component library

---

**Built by Sharada Raghunatha**
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
