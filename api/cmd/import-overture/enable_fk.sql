-- Run this after import_admin_boundaries.py to re-enable the FK constraint on geo_names
ALTER TABLE geo_names
    ADD CONSTRAINT geo_names_language_code_fkey
    FOREIGN KEY (language_code) REFERENCES languages(code) ON DELETE CASCADE;
