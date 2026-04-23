-- Remove strict constraints on Room Type and Status to allow 'Ward', 'Occupied', etc.
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_type_check;
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_status_check;

-- Add simple check to ensure they are not empty
ALTER TABLE rooms ADD CONSTRAINT rooms_type_check CHECK (length(type) > 0);
ALTER TABLE rooms ADD CONSTRAINT rooms_status_check CHECK (length(status) > 0);
