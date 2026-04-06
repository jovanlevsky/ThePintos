CREATE DATABASE IF NOT EXISTS tuneup;

USE tuneup;

-- users 
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120)    NOT NULL,
  email         VARCHAR(255)    NOT NULL,
  password_hash VARCHAR(255)    NOT NULL,         -- bcrypt hash
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
);

-- pass reset tokens 
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED  NOT NULL,
  token      VARCHAR(128)  NOT NULL,   -- cryptographically random token 
  expires_at DATETIME      NOT NULL,
  used       TINYINT(1)    NOT NULL DEFAULT 0,
  created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_prt_token (token),
  KEY idx_prt_user (user_id),
  CONSTRAINT fk_prt_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

-- vehicles 
CREATE TABLE IF NOT EXISTS vehicles (
  id                   INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  user_id              INT UNSIGNED   NOT NULL,
  make                 VARCHAR(80)    NOT NULL,
  model                VARCHAR(80)    NOT NULL,
  year                 SMALLINT       NOT NULL,
  vin                  CHAR(17)       DEFAULT NULL,
  license_plate        VARCHAR(20)    DEFAULT NULL,
  current_mileage      INT UNSIGNED   NOT NULL DEFAULT 0,
  fuel_type            ENUM(
                         'Gasoline','Diesel',
                         'Electric','Hybrid','Plug-in Hybrid'
                       )              DEFAULT NULL,
  oil_type             VARCHAR(20)    DEFAULT NULL,   -- "0W-20" 
  oil_change_interval  INT UNSIGNED   DEFAULT NULL,   -- miles 
  created_at           DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                      ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_vehicles_user (user_id),
  CONSTRAINT fk_vehicles_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

-- maintenance log 
CREATE TABLE IF NOT EXISTS maintenance_records (
  id                 INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  vehicle_id         INT UNSIGNED  NOT NULL,
  user_id            INT UNSIGNED  NOT NULL, 
  service_type       VARCHAR(80)   NOT NULL,
  service_date       DATE          NOT NULL,
  mileage_at_service INT UNSIGNED  NOT NULL,
  notes              TEXT          DEFAULT NULL,
  created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_mr_vehicle   (vehicle_id),
  KEY idx_mr_user      (user_id),
  KEY idx_mr_date      (service_date),
  KEY idx_mr_type      (service_type),
  CONSTRAINT fk_mr_vehicle
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_mr_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

-- reminders 
CREATE TABLE IF NOT EXISTS reminders (
  id                    INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  vehicle_id            INT UNSIGNED  NOT NULL,
  user_id               INT UNSIGNED  NOT NULL,
  service_type          VARCHAR(80)   NOT NULL,
  reminder_mode         ENUM('miles','time','either') NOT NULL DEFAULT 'either',
  interval_miles        INT UNSIGNED  DEFAULT NULL,
  interval_months       TINYINT UNSIGNED DEFAULT NULL,
  last_service_mileage  INT UNSIGNED  NOT NULL,
  last_service_date     DATE          NOT NULL,
  created_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                      ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_rem_vehicle (vehicle_id),
  KEY idx_rem_user    (user_id),
  CONSTRAINT fk_rem_vehicle
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_rem_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);
