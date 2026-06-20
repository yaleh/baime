# Exp-K Baseline Summary Report

## Metrics

| Metric | Value |
|--------|-------|
| task_total | 10 |
| replan_total | 4 |
| replan_rate | 40.0% |
| Met_rate | 80.0% |

## Root-Cause Breakdown

| Category | Count | % of replans |
|----------|-------|-------------|
| impl | 1 | 25% |
| sub-plan | 1 | 25% |
| meta-plan | 0 | 0% |
| harness | 1 | 25% |
| infeasible | 1 | 25% |

## Evaluator Distribution

| Verdict | Count |
|---------|-------|
| Met | 8 |
| NotMet | 2 |

## P4 Gate Assessment

Met_rate=80% exceeds the 70% threshold. replan_rate=40% is within acceptable range.
ROI gate status: PASS (pending check-roi-gate.sh confirmation in TASK-93.11).
