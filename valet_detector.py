from ultralytics import YOLO
import cv2

model = YOLO('best.pt')
cap = cv2.VideoCapture(0)

print("�� Valet Parking - License Plate Detector")
print("📊 Confidence threshold: 40%")
print("💡 Press 'q' to quit\n")

while True:
    ret, frame = cap.read()
    if not ret:
        break
    
    # Use 0.4 confidence to catch both angled AND straight
    results = model(frame, conf=0.4, verbose=False)
    
    # Draw detections
    annotated_frame = results[0].plot()
    
    # Log detections
    for box in results[0].boxes:
        conf = box.conf[0].item()
        if conf >= 0.4:  # Only log 40%+ detections
            print(f"✅ Plate detected: {conf:.1%} confidence")
    
    cv2.imshow('Valet Parking System', annotated_frame)
    
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
