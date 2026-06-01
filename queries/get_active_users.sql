-- Title: Active Users Report
-- Description: Retrieve a list of users who have been active in the last 30 days, along with their login counts and membership tier.
-- Tags: users, analytics, activity
-- Created: 2026-05-15

SELECT 
    u.id AS user_id,
    u.username,
    u.email,
    u.membership_tier,
    COUNT(l.id) AS login_count,
    MAX(l.login_time) AS last_login
FROM users u
LEFT JOIN login_logs l ON u.id = l.user_id
WHERE l.login_time >= NOW() - INTERVAL '30 days'
GROUP BY u.id, u.username, u.email, u.membership_tier
HAVING COUNT(l.id) >= 5
ORDER BY login_count DESC;
