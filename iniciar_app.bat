@echo off
title Consulta de Resultados
echo ========================================================
echo   Iniciando Consulta de Resultados - Elecciones
echo ========================================================
echo.
echo Conectando en vivo a Google Sheets y abriendo en navegador...
start http://127.0.0.1:5000
python app.py
pause
