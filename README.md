# Total : 1M rows

## Without Index
<img width="1254" height="625" alt="Screenshot 2026-03-02 at 3 30 52 PM" src="https://github.com/user-attachments/assets/8538005b-8aa2-4857-90ab-ec36f081bdc0" />

## Index on author
<img width="1254" height="625" alt="Screenshot 2026-03-02 at 3 40 01 PM" src="https://github.com/user-attachments/assets/6d2d52a8-8547-4a36-80a1-0682cd4a7f4f" />

Why index ??
Without the index Postgress Does a full table scan. It will load all the rows and then filter to get  1 row .
With index Posgtress does a scan on the index . Index are often stored as B-trees. The time complexity is O(log n ) which better then O(N) for full table scan.
