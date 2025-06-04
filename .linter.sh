#!/bin/bash
cd /home/kavia/workspace/code-generation/teekomaster-102863-1c1d80b1/teekomaster_game
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

