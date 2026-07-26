#!/bin/bash
cd /home/z/my-project
while true; do
  if ! pgrep -f "next-server" > /dev/null 2>&1; then
    NODE_OPTIONS="--max-old-space-size=1024" nohup bun run next dev -p 3000 >> /home/z/my-project/dev.log 2>&1 &
    sleep 20
  fi
  curl -s -o /dev/null --max-time 5 http://localhost:3000/ 2>/dev/null
  sleep 8
done
