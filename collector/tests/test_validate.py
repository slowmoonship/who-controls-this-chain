from collector import validate


def test_sudden_change():
    assert validate.sudden_change(100, 40) is True  # -60%
    assert validate.sudden_change(100, 60) is False  # -40%
    assert validate.sudden_change(100, 200) is True  # +100%
    assert validate.sudden_change(0, 5) is False  # no baseline


def test_check_validator_count_ok():
    assert validate.check_validator_count(100, 95) == []
    assert validate.check_validator_count(None, 544) == []


def test_check_validator_count_anomaly():
    warnings = validate.check_validator_count(100, 1)
    assert validate.is_anomalous(warnings)


def test_check_validator_count_zero():
    warnings = validate.check_validator_count(None, 0)
    assert warnings and not validate.is_anomalous(warnings)


def test_check_weights_anomaly():
    warnings = validate.check_weights(10**18, 10**17)
    assert validate.is_anomalous(warnings)


def test_check_shares_inconsistent():
    warnings = validate.check_shares(top10=0.9, max_s=0.1, count=5)
    assert warnings  # 0.1*5=0.5 < 0.9


def test_check_shares_consistent():
    assert validate.check_shares(0.2, 0.02, 544) == []


def test_is_anomalous_false_for_plain_warnings():
    assert validate.is_anomalous(["active validator count is zero or negative"]) is False
