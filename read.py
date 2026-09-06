import csv
import re
from pathlib import Path
from collections import defaultdict

# โฟลเดอร์โปรเจกต์ที่ต้องการสแกน
PROJECT_FOLDER = Path("my_project")

# selector -> รายชื่อไฟล์และจำนวนที่พบ
results = defaultdict(lambda: defaultdict(int))


def add_result(selector_type, name, file_path):
    """เพิ่มผลลัพธ์ลงในตัวแปร results"""
    if not name:
        return

    selector = f".{name}" if selector_type == "Class" else f"#{name}"
    key = (selector_type, selector)

    results[key][str(file_path)] += 1


def remove_comments(content, file_type):
    """ลบ comment เพื่อลดผลลัพธ์ที่ไม่เกี่ยวข้อง"""
    if file_type in {".css", ".js"}:
        content = re.sub(r"/\*.*?\*/", "", content, flags=re.DOTALL)

    if file_type == ".js":
        content = re.sub(r"//.*?$", "", content, flags=re.MULTILINE)

    return content


def scan_html(content, file_path):
    """ค้นหา class และ id ใน HTML"""
    # class="container active"
    class_matches = re.findall(
        r"""\bclass\s*=\s*["']([^"']+)["']""",
        content,
        flags=re.IGNORECASE,
    )

    for class_group in class_matches:
        for class_name in class_group.split():
            add_result("Class", class_name, file_path)

    # id="header"
    id_matches = re.findall(
        r"""\bid\s*=\s*["']([^"']+)["']""",
        content,
        flags=re.IGNORECASE,
    )

    for id_name in id_matches:
        add_result("ID", id_name.strip(), file_path)


def scan_css(content, file_path):
    """ค้นหา Class และ ID ที่อยู่ใน CSS selector"""
    content = remove_comments(content, ".css")

    # อ่านเฉพาะข้อความก่อนเครื่องหมาย {
    selector_blocks = re.findall(r"([^{}]+)\{", content)

    for selector_block in selector_blocks:
        # ข้ามกฎ เช่น @media, @keyframes, @font-face
        if selector_block.strip().startswith("@"):
            continue

        # ตัวอย่าง: .card, .menu.active
        classes = re.findall(
            r"\.([A-Za-z_][A-Za-z0-9_-]*)",
            selector_block,
        )

        # ตัวอย่าง: #header
        ids = re.findall(
            r"#([A-Za-z_][A-Za-z0-9_-]*)",
            selector_block,
        )

        for class_name in classes:
            add_result("Class", class_name, file_path)

        for id_name in ids:
            add_result("ID", id_name, file_path)


def scan_js(content, file_path):
    """ค้นหา Class และ ID จากคำสั่ง JavaScript ที่พบบ่อย"""
    content = remove_comments(content, ".js")

    # document.getElementById("header")
    for id_name in re.findall(
        r"""getElementById\s*\(\s*["']([^"']+)["']\s*\)""",
        content,
    ):
        add_result("ID", id_name, file_path)

    # document.getElementsByClassName("card active")
    for class_group in re.findall(
        r"""getElementsByClassName\s*\(\s*["']([^"']+)["']\s*\)""",
        content,
    ):
        for class_name in class_group.split():
            add_result("Class", class_name, file_path)

    # element.className = "card active"
    for class_group in re.findall(
        r"""\.className\s*=\s*["']([^"']+)["']""",
        content,
    ):
        for class_name in class_group.split():
            add_result("Class", class_name, file_path)

    # classList.add("active", "open")
    # classList.remove(), toggle(), contains(), replace()
    class_list_calls = re.findall(
        r"""\.classList\.(?:add|remove|toggle|contains|replace)\s*\((.*?)\)""",
        content,
        flags=re.DOTALL,
    )

    for arguments in class_list_calls:
        string_values = re.findall(r"""["']([^"']+)["']""", arguments)

        for value in string_values:
            # ป้องกันการแยกชื่อ class ที่มีช่องว่างโดยไม่ตั้งใจ
            for class_name in value.split():
                add_result("Class", class_name, file_path)

    # querySelector(".card"), querySelectorAll("#menu .item")
    selector_calls = re.findall(
        r"""(?:querySelector|querySelectorAll|matches|closest)\s*
            \(\s*["']([^"']+)["']\s*\)""",
        content,
        flags=re.VERBOSE,
    )

    for selector in selector_calls:
        classes = re.findall(
            r"\.([A-Za-z_][A-Za-z0-9_-]*)",
            selector,
        )
        ids = re.findall(
            r"#([A-Za-z_][A-Za-z0-9_-]*)",
            selector,
        )

        for class_name in classes:
            add_result("Class", class_name, file_path)

        for id_name in ids:
            add_result("ID", id_name, file_path)


def scan_project(folder):
    """สแกนไฟล์ HTML, CSS และ JS ทั้งหมด"""
    supported_extensions = {".html", ".htm", ".css", ".js"}

    for file_path in folder.rglob("*"):
        if not file_path.is_file():
            continue

        extension = file_path.suffix.lower()

        if extension not in supported_extensions:
            continue

        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")

            if extension in {".html", ".htm"}:
                scan_html(content, file_path)
            elif extension == ".css":
                scan_css(content, file_path)
            elif extension == ".js":
                scan_js(content, file_path)

            print(f"อ่านแล้ว: {file_path}")

        except Exception as error:
            print(f"อ่านไฟล์ไม่ได้: {file_path} ({error})")


def save_csv(output_file):
    """บันทึกผลเป็น CSV"""
    with open(
        output_file,
        "w",
        newline="",
        encoding="utf-8-sig",
    ) as file:
        writer = csv.writer(file)

        writer.writerow([
            "ประเภท",
            "Selector",
            "จำนวนทั้งหมด",
            "จำนวนไฟล์",
            "ไฟล์ที่พบ",
        ])

        for (selector_type, selector), files in sorted(results.items()):
            total_count = sum(files.values())

            file_details = "; ".join(
                f"{file_name} ({count})"
                for file_name, count in sorted(files.items())
            )

            writer.writerow([
                selector_type,
                selector,
                total_count,
                len(files),
                file_details,
            ])


if __name__ == "__main__":
    if not PROJECT_FOLDER.exists():
        print(f"ไม่พบโฟลเดอร์: {PROJECT_FOLDER}")
    else:
        scan_project(PROJECT_FOLDER)
        save_csv("selectors.csv")

        class_total = sum(
            1 for selector_type, _ in results
            if selector_type == "Class"
        )
        id_total = sum(
            1 for selector_type, _ in results
            if selector_type == "ID"
        )

        print("\nสแกนเรียบร้อยแล้ว")
        print(f"Class ที่ไม่ซ้ำ: {class_total}")
        print(f"ID ที่ไม่ซ้ำ: {id_total}")
        print("บันทึกผลไว้ที่: selectors.csv")