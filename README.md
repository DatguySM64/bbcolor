I present to you my terrible code!

# BBColor
A simple vertex color plugin for Blockbench.

## About
Vertex colors are a pretty common feature request for Blockbench, and at some point I just got tired of importing my model into Blender over and over and over to add vertex colors. So I took matters into my own hands.

This implementation of vertex colors is very much based on Blender vertex colors, which are stored at the face corner.

> [!NOTE]
> This plugin has some <ins>very</ins> specific features because of my specific use case (Super Mario 64).
> The most prominent example is that vertex colored meshes will not have shading.

In my eyes this plugin is almost feature-complete already due to its very specific use case. It does what I need it to do.

## Features

### The Vertex Painter

This really wouldn't be a vertex color plugin without a vertex painter, would it?
The vertex painter is basically the access point into this whole vertex-coloring thing.
Within this tool you'll find around 5 options related directly to it, those being:
- Brush Radius: Controls the radius of the brush
- Disable Depth Check: When enabled, even vertices you can't see are able to be painted on.
- Affect Alpha: You can only set the alpha of a vertex if this option is enabled.
- Alpha: The alpha value from the color picker is not read; instead this slider is used.
- Select Mode: Disables the main vertex painter and allows you to select faces for use as a mask.

You may notice that just dragging the brush around does nothing when painting. This is because the painter requires a **selection mask** which tells the brush which faces it can paint.
Once you have faces selected, clicking anywhere on the mesh and dragging will paint the vertices in range of the mouse with the primary color as long as their parent face is selected.
If you click on a mesh, the camera will not move to aid in brush painting. If you click on the background or the rotation helper, the camera will move and no faces will be painted.

> [!NOTE]
> This tool can only be selected if the selected element is a mesh.

### Toggling Vertex Colors

Even if you have faces selected, the mesh may not appear to change. This is because vertex colors are toggleable per mesh. If a mesh does not have vertex colors enabled, they won't render or export any color data, and shading will be enabled for that mesh.
> [!NOTE]
> If the option to toggle vertex colors does not show up for you, ensure you have "Toggle More Options" enabled in the outliner.

### The Color Picker

How would you paint a color if there was no color?
This color picker is the same one as the one in Paint mode, and functions the same as well. The primary color is used for painting. If you swap to the pallete, the selected color there will be used.
There's not really much to this one, honestly.

### Tint Modes

Tint modes are helpful for adding shadows, or perhaps removing them. There are three tint modes you can pick from:
- None: Simply sets the vertex color
- Tint: Tints the existing color and alpha with multiplicative blending.
- De-tint: Attempts to remove a tint from a vertex.

> [!NOTE]
> The method of reconstruction from de-tint does not work the greatest; if either the color to remove the tint from
> or the color used as the tint to remove has 0 as one of its channels, the value gets set to 1 (full white/alpha).
> This may produce unwanted effects.

### The Fill Tool

The fill tool can be extremely useful for painting large sections of a mesh quickly. 
It's usage is very simple: using the tool will paint all selected faces with the primary color from the color picker.

### Quick Shade

This tool is, as its name implies, a quick method of shading meshes. It affects all selected faces. Upon using the tool, you will be greeted by a dialog:

<img width="357" height="255" alt="image" src="https://github.com/user-attachments/assets/a2007edf-a842-433d-95c8-a5d8f06b2f19" />

- Color 1: The brightest color a face can reach.
- Color 2: The darkest color a face can reach.
- X, Y, and Z rotation: The rotation, in degrees, to apply to the "light".

This tool's shading is very similar to Blockbench's default shading. If a face is fully facing the light (positioned directly up by default) it is fully Color 1, and facing directly away is Color 2.
If you're worried about smooth shading, don't. This tool has full support for smooth shaded meshes.

If a provided color has alpha, it will be applied, but **only** if the "Affect Alpha" option is checked in the vertex painter.

### Light-Based Shade

A slightly more complex method of shading, light-based shade not only has a more accurate simulation of light, it supports shadows. Similar to the quick shade tool, a dialog appears when the tool is used:

<img width="360" height="317" alt="image" src="https://github.com/user-attachments/assets/940553f1-f4c1-4211-9a54-0ab79e22bd0d" />

- Light Color: The brightest color a face can reach.
- Shade Color: The darkest color a face can reach.
- Shadow Tint: If a face is considered to be in a shadow, this tint is applied via multiplicative blending.
- Rotation X, Y, and Z: The rotation, in degrees, to apply to the "light".
- Smooth Shadows: If this option is checked, shadows are calculated per vertex instead of per face. This is **NOT** the same as smooth shading.

Similar to quick shading, the light is directly up by default. The shadows are calculated via a raycast from the face (or vertex) position going towards the light. 
It ignores backfacing faces and hidden meshes, but the first front-facing face it hits creates a shadow. Sometimes this produces results you may not like. In that case, shadows can be disabled by setting the shadow to tint to white (#FFFFFF).
Again, alpha is only applied if "Affect Alpha" is checked. Smooth shading is fully supported.

## Extras

One of the key features of this plugin is the ability to export said vertex colors into file formats. Currently only FBX is supported. With FBX exporting, this actually fixes an issue with ASCII exports where all materials use texture #1.
FBX binary export is still broken. It's marked as experimental for a reason, folks.

## Known Issues

- The color panel can be intrusive.
- The shadow logic for light-based shading is not the greatest, it occasionally produces jagged edges.
- Changing a mesh's vertex color toggle status does not immediately update the preview. Any edits made to the mesh will show the modifications.

> [!CAUTION]
> The plugin's unload statement is <ins>unfinished</ins>. If you do end up reloading or unloading this plugin, things will likely break unless you restart Blockbench.

I've likely forgotten something here, so please let me know if anything is missing!
