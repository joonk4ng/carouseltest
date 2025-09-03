// file for image storage from camera
import { openDB } from 'idb';

// set database name
const DB_NAME = 'ctr-image-storage';
// set store name
const STORE_NAME = 'images';
// set database version
const DB_VERSION = 1;

export interface ImageData {
  id: string;
  image: Blob;
  metadata: {
    filename: string;
    date: string;
    crewNumber: string;
    fireName: string;
    fireNumber: string;
    mimeType: string;
  };
  timestamp: string;
}

// Initialize the database
async function initDB() {
  return openDB<ImageData>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
}

// Store an image in IndexedDB
export async function storeImage(imageBlob: Blob, metadata: {
  filename: string;
  date: string;
  crewNumber: string;
  fireName: string;
  fireNumber: string;
  mimeType: string;
}) {
  const db = await initDB();
  const id = `${metadata.date}_${metadata.crewNumber}_${metadata.fireName}_${metadata.fireNumber}`;
  try {
    await db.put(STORE_NAME, {
      id,
      image: imageBlob,
      metadata,
      timestamp: new Date().toISOString()
    });
    return id;
  } catch (error) {
    throw error;
  }
}

// Retrieve an image from IndexedDB
export async function getImage(id: string) {
  const db = await initDB();
  return db.get(STORE_NAME, id);
}

// List all stored images
export async function listImages() {
  const db = await initDB();
  return db.getAll(STORE_NAME);
}

// Delete an image from IndexedDB
export async function deleteImage(id: string) {
  const db = await initDB();
  await db.delete(STORE_NAME, id);
} 