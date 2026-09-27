from database.connection import get_connection


try:
    conn = get_connection()
    print("Database connection successful!")
    conn.close()

except Exception as e:
    print("Database connection failed:")
    print(e)