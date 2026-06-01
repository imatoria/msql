-- Title: Monthly Sales & Revenue
-- Description: Summarize total revenue, number of transactions, and average order value grouped by month and product category.
-- Tags: sales, finance, reports
-- Created: 2026-05-20

SELECT 
    DATE_TRUNC('month', o.order_date) AS sales_month,
    p.category AS product_category,
    COUNT(DISTINCT o.id) AS total_orders,
    SUM(oi.quantity * oi.unit_price) AS gross_revenue,
    AVG(o.total_amount) AS average_order_value
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
JOIN products p ON oi.product_id = p.id
WHERE o.status = 'Completed'
  AND o.order_date >= '2025-01-01'
GROUP BY DATE_TRUNC('month', o.order_date), p.category
ORDER BY sales_month DESC, gross_revenue DESC;
