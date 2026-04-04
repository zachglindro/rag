from preprocessing.description_builder import build_natural_language_description


class TestDescriptionBuilder:
    def test_builds_description_with_deterministic_default_order(self):
        row = {
            "plant_height": 180,
            "local_name": "IPB-99",
            "tassel_color": "Purple",
            "kernel_type": "Flint",
        }

        description = build_natural_language_description(row)

        assert description.startswith("Record with kernel type Flint")
        assert description.index("local name IPB-99") < description.index(
            "plant height 180"
        )
        assert "kernel type Flint" in description
        assert "tassel color Purple" in description
        assert "plant height 180" in description

    def test_builds_description_with_provided_column_order(self):
        row = {
            "plant_height": 180,
            "local_name": "IPB-99",
            "kernel_type": "Flint",
        }

        description = build_natural_language_description(
            row, column_order=["local_name", "plant_height"]
        )

        assert description.startswith("Record with local name IPB-99")
        assert description.index("plant height 180") < description.index(
            "kernel type Flint"
        )

    def test_skips_empty_and_null_like_values(self):
        row = {
            "local_name": "IPB-99",
            "kernel_type": " ",
            "disease_observed": "N/A",
            "plants_lodged": None,
        }

        description = build_natural_language_description(row)

        assert description == "Record with local name IPB-99."

    def test_returns_fallback_for_empty_row(self):
        row = {"kernel_type": "", "plants_lodged": None}

        description = build_natural_language_description(row)

        assert description == "No trait information provided for this record."
