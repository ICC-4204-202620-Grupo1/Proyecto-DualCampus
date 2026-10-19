-- Solo para el PostgreSQL local de docker-compose (se ejecuta al crear el volumen).
-- La API se conecta con un rol normal: un superusuario se saltaría el Row-Level Security.
CREATE ROLE dualcampus LOGIN PASSWORD 'dualcampus' NOSUPERUSER NOCREATEROLE;
CREATE DATABASE dualcampus OWNER dualcampus;
