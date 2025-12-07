#!/usr/bin/env python3
"""
Convert master_registry.go from raw SQL to SQLc-generated methods.
This script performs systematic replacements to eliminate all Pool.* calls.
"""

import re

def convert_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Conversion 1: GetZmanVersionDetail (GetZmanVersion) - already exists in SQL
    content = re.sub(
        r'''	var v ZmanVersion
	err = h\.db\.Pool\.QueryRow\(ctx, `
		SELECT pzv\.id, pzv\.publisher_zman_id, pzv\.version_number,
			pzv\.formula_dsl, pzv\.created_by, pzv\.created_at
		FROM publisher_zman_versions pzv
		JOIN publisher_zmanim pz ON pz\.id = pzv\.publisher_zman_id
		WHERE pz\.publisher_id = \$1 AND pz\.zman_key = \$2 AND pzv\.version_number = \$3
	`, publisherID, zmanKey, version\)\.Scan\(&v\.ID, &v\.PublisherZmanID, &v\.VersionNumber,
		&v\.FormulaDSL, &v\.CreatedBy, &v\.CreatedAt\)

	if err == pgx\.ErrNoRows \{
		RespondNotFound\(w, r, "Version not found"\)
		return
	\}
	if err != nil \{
		slog\.Error\("error getting zman version", "error", err\)
		RespondInternalError\(w, r, "Failed to get version"\)
		return
	\}''',
        r'''	publisherIDInt, err := stringToInt32(publisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	row, err := h.db.Queries.GetZmanVersion(ctx, sqlcgen.GetZmanVersionParams{
		PublisherID:   publisherIDInt,
		ZmanKey:       zmanKey,
		VersionNumber: version,
	})
	if err == pgx.ErrNoRows {
		RespondNotFound(w, r, "Version not found")
		return
	}
	if err != nil {
		slog.Error("error getting zman version", "error", err)
		RespondInternalError(w, r, "Failed to get version")
		return
	}

	v := ZmanVersion{
		ID:              row.ID,
		PublisherZmanID: row.PublisherZmanID,
		VersionNumber:   row.VersionNumber,
		FormulaDSL:      row.FormulaDsl,
		CreatedBy:       row.CreatedBy,
		CreatedAt:       row.CreatedAt,
	}''',
        content,
        flags=re.DOTALL
    )

    # Write back
    with open(filepath, 'w') as f:
        f.write(content)

    print(f"Converted {filepath}")

if __name__ == "__main__":
    convert_file("/home/daniel/repos/zmanim-lab/api/internal/handlers/master_registry.go")
