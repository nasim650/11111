#!/bin/bash
cd /home/z/my-project
pkill -f "next" 2>/dev/null
sleep 2
NODE_OPTIONS="--max-old-space-size=1024" exec bun run next dev -p 3000 > /home/z/my-project/dev.log 2>&1
