# Total : 1M rows

## Without Index
<img width="1254" height="625" alt="Screenshot 2026-03-02 at 3 30 52 PM" src="https://github.com/user-attachments/assets/8538005b-8aa2-4857-90ab-ec36f081bdc0" />

## Index on author
<img width="1254" height="625" alt="Screenshot 2026-03-02 at 3 40 01 PM" src="https://github.com/user-attachments/assets/6d2d52a8-8547-4a36-80a1-0682cd4a7f4f" />

Why index ??
Without the index Postgress Does a full table scan. It will load all the rows and then filter to get  1 row .
With index Posgtress does a scan on the index . Index are often stored as B-trees. The time complexity is O(log n ) which better then O(N) for full table scan.


##  GIN + Trigram Index
<img width="1254" height="625" alt="Screenshot 2026-03-02 at 4 17 33 PM" src="https://github.com/user-attachments/assets/9bd9b6e1-0f21-4476-aa4b-42532c746d34" />
First of all there is no index. Second B-tree index can't be help because '%abc%' prefix is not fixed.  So we have to use Gin+Trigram Index

``CREATE EXTENSION pg_trgm;
CREATE INDEX idx_content_trgm
ON posts
USING GIN (content gin_trgm_ops);``

This took a hell lot of a time. Creating index on this is this efficient ?? Umm maybe use can use Open-Search and use debezium to push data from postgress ??
<img width="1254" height="625" alt="Screenshot 2026-03-02 at 4 24 28 PM" src="https://github.com/user-attachments/assets/2343c723-beee-407b-87d9-7bd0a37e360a" />

After the index it is fast. 
<img width="1254" height="625" alt="Screenshot 2026-03-02 at 4 26 39 PM" src="https://github.com/user-attachments/assets/7d9521e3-0409-496c-ae9b-ff4340061b01" />
