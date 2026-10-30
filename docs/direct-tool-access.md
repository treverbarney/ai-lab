# Direct tool access

Primary neural buttons open hosted interactive viewers directly. Desktop uses its isolated WebContentsView; the browser companion embeds the three catalog origins in a workspace with Dino navigation and an explicit Open in tab fallback. Setup remains a separate control. Hosted viewers require internet; this is not a local runtime readiness claim.

CAD opens the assembly editor. Browser Fusion opens its connected controls; desktop native Fusion/FreeCAD buttons launch their native applications. Native editors are not embedded browser applications. Training and physics still use existing starter-job panels.

Validation on the Mac: all 31 existing tests passed. Headless Chrome exercised actual browser companion clicks: Neural rendered a canvas, Attention loaded its interactive controls, CAD rendered the assembly viewport, and no page errors occurred. Layers loaded its example gallery. Native desktop launch and local neural runtime installation were still pending during this check.
