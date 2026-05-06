# FastOrderHA
Sistema de pedidos en línea para restaurante con cocina, inventario y despacho.

# Estructura del Proyecto

FASTORDERHA
|
├── api-gateway/
|
├── menu-service/
├── order-service/
├── inventory-service/
├── kitchen-service/
├── delivery-service/
├── notification-service/
│
├── database/
│   ├── migrations/
│   └── init.sql
│
├── monitoring/
│   ├── prometheus.yml
│   └── grafana/
│
├── tests/
│   └── load-test.js
│
├── docker-compose.yml
└── README.md