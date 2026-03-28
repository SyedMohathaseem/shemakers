/* ============================================
   SheMakers — Products Module (CRUD)
   ============================================ */

const Products = (() => {

  const COLLECTION = 'products';
  const DEMO_TARGET_COUNT = 60;
  const HANDMADE_CATEGORIES = [
    'homemade-food',
    'handmade-art',
    'painting-illustration',
    'crafts-decor',
    'accessories-fashion',
    'home-essentials',
    'gifting',
    'other-handmade'
  ];

  const DEMO_SELLERS = [
    { id: 'demo_seller_01', name: 'Asha Verma', phone: '919810001001', role: 'seller' },
    { id: 'demo_seller_02', name: 'Nida Khan', phone: '919810001002', role: 'seller' },
    { id: 'demo_seller_03', name: 'Meera Joshi', phone: '919810001003', role: 'seller' },
    { id: 'demo_seller_04', name: 'Ritika Das', phone: '919810001004', role: 'seller' },
    { id: 'demo_seller_05', name: 'Farah Ali', phone: '919810001005', role: 'seller' },
    { id: 'demo_seller_06', name: 'Kavya Rao', phone: '919810001006', role: 'seller' }
  ];

  const DEMO_VIDEO_URLS = [
    'https://www.w3schools.com/html/mov_bbb.mp4',
    'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    'https://samplelib.com/lib/preview/mp4/sample-5s.mp4',
    'https://samplelib.com/lib/preview/mp4/sample-10s.mp4'
  ];

  const DEMO_TITLES = [
    'Acrylic Floral Wall Painting',
    'Handmade Resin Tray Set',
    'Embroidered Potli Bag',
    'Natural Soy Aroma Candle',
    'Crochet Phone Sling',
    'Terracotta Tea Cup Pair',
    'Watercolor Bookmark Pack',
    'Handcrafted Rakhi Hamper',
    'Macrame Plant Hanger',
    'Wooden Name Plate Art',
    'Festive Mithai Gift Box',
    'Homestyle Pickle Jar',
    'Canvas Tote with Handpaint',
    'Handmade Beaded Earrings',
    'Block Print Table Runner',
    'Clay Diyas Set',
    'Mini Journal Art Kit',
    'Custom Portrait Sketch',
    'Jute Storage Basket',
    'Handmade Chocolate Fudge'
  ];

  function containsProhibitedContent(text) {
    const blocked = /(vlog|gaming|comedy|dance|travel|entertainment|movie|music|podcast|prank|lifestyle|livestream|reaction|roast)/i;
    return blocked.test(text || '');
  }

  function validateHandmadeListing({ title, description, category }) {
    const merged = `${title || ''} ${description || ''}`.toLowerCase();

    if (!category || !HANDMADE_CATEGORIES.includes(category)) {
      throw new Error('Please choose a valid handmade product category');
    }

    if (containsProhibitedContent(merged)) {
      throw new Error('Only handmade products are allowed. Entertainment/video-vlog content is not accepted.');
    }

    if ((title || '').trim().length < 3) {
      throw new Error('Please add a clear handmade product title');
    }
  }

  function demoImageUrl(index) {
    const seed = `shemakers_demo_${index + 1}`;
    return `https://picsum.photos/seed/${seed}/1200/1500`;
  }

  async function ensureDemoSellers() {
    for (const seller of DEMO_SELLERS) {
      const ref = db.collection('users').doc(seller.id);
      const existing = await ref.get();
      if (!existing.exists) {
        await ref.set({
          id: seller.id,
          name: seller.name,
          phone: seller.phone,
          role: seller.role,
          isWomanSeller: true,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          isDemo: true
        });
      }
    }
  }

  async function seedDemoProducts(targetCount = DEMO_TARGET_COUNT) {
    const allProducts = await getAllProducts();
    if (allProducts.length >= targetCount) {
      return { seeded: false, count: allProducts.length };
    }

    await ensureDemoSellers();
    const toCreate = targetCount - allProducts.length;

    for (let i = 0; i < toCreate; i++) {
      const seller = DEMO_SELLERS[i % DEMO_SELLERS.length];
      const globalIndex = allProducts.length + i;
      const isVideo = globalIndex % 5 === 0;
      const title = DEMO_TITLES[globalIndex % DEMO_TITLES.length];
      const docRef = db.collection(COLLECTION).doc();

      const productData = {
        id: docRef.id,
        userId: seller.id,
        title: `${title} #${globalIndex + 1}`,
        description: 'Women-led handmade creation crafted with care for direct customer orders.',
        price: 249 + ((globalIndex % 14) * 85),
        mediaUrl: isVideo
          ? DEMO_VIDEO_URLS[globalIndex % DEMO_VIDEO_URLS.length]
          : demoImageUrl(globalIndex),
        mediaType: isVideo ? 'video' : 'image',
        category: HANDMADE_CATEGORIES[globalIndex % HANDMADE_CATEGORIES.length],
        storagePath: null,
        whatsapp: seller.phone,
        createdAt: new Date(Date.now() - (globalIndex * 3600000)).toISOString(),
        isDemo: true
      };

      await docRef.set(productData);
    }

    return { seeded: true, count: targetCount };
  }

  async function resolveMediaUrl(product) {
    if (!product) return product;
    if (!product.storagePath) return product;

    try {
      const freshUrl = await storage.ref(product.storagePath).getDownloadURL();
      return { ...product, mediaUrl: freshUrl };
    } catch (e) {
      // Keep existing URL so cards can still render a fallback state.
      return product;
    }
  }

  // ---------- Add Product ----------
  async function addProduct({ title, description, price, whatsapp, file, userId, category }) {
    if (!title || !price || !whatsapp || !file) {
      throw new Error('Title, price, WhatsApp number, and media file are required');
    }

    validateHandmadeListing({ title, description, category });

    // Upload file to Firebase Storage
    const ext = file.name.split('.').pop();
    const filename = `products/${userId}_${Date.now()}.${ext}`;
    const storageRef = storage.ref(filename);
    const uploadTask = await storageRef.put(file);
    const mediaUrl = await uploadTask.ref.getDownloadURL();

    // Determine media type
    const mediaType = file.type.startsWith('video') ? 'video' : 'image';

    // Create product doc
    const docRef = db.collection(COLLECTION).doc();
    const productData = {
      id: docRef.id,
      userId,
      title: title.trim(),
      description: (description || '').trim(),
      price: parseFloat(price),
      mediaUrl,
      mediaType,
      category,
      storagePath: filename,
      whatsapp: whatsapp.trim(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await docRef.set(productData);
    return productData;
  }

  // ---------- Get All Products ----------
  async function getAllProducts() {
    const snapshot = await db.collection(COLLECTION)
      .orderBy('createdAt', 'desc')
      .get();

    const products = snapshot.docs
      .map(doc => doc.data())
      .filter(product => !containsProhibitedContent(`${product.title || ''} ${product.description || ''}`));
    return Promise.all(products.map(resolveMediaUrl));
  }

  // ---------- Get Products by Seller ----------
  async function getSellerProducts(userId) {
    const snapshot = await db.collection(COLLECTION)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const products = snapshot.docs
      .map(doc => doc.data())
      .filter(product => !containsProhibitedContent(`${product.title || ''} ${product.description || ''}`));
    return Promise.all(products.map(resolveMediaUrl));
  }

  // ---------- Get Single Product ----------
  async function getProduct(productId) {
    const doc = await db.collection(COLLECTION).doc(productId).get();
    if (!doc.exists) throw new Error('Product not found');
    return resolveMediaUrl(doc.data());
  }

  // ---------- Update Product ----------
  async function updateProduct(productId, data, newFile) {
    const updateData = {};

    if (data.title) updateData.title = data.title.trim();
    if (data.description !== undefined) updateData.description = data.description.trim();
    if (data.price) updateData.price = parseFloat(data.price);
    if (data.whatsapp) updateData.whatsapp = data.whatsapp.trim();
    if (data.category) updateData.category = data.category;

    validateHandmadeListing({
      title: data.title,
      description: data.description,
      category: data.category
    });

    // If a new file is provided, upload it
    if (newFile) {
      // Delete old file
      const oldDoc = await db.collection(COLLECTION).doc(productId).get();
      if (oldDoc.exists && oldDoc.data().storagePath) {
        try {
          await storage.ref(oldDoc.data().storagePath).delete();
        } catch (e) { /* ignore if already deleted */ }
      }

      const ext = newFile.name.split('.').pop();
      const filename = `products/${data.userId || 'unknown'}_${Date.now()}.${ext}`;
      const storageRef = storage.ref(filename);
      const uploadTask = await storageRef.put(newFile);
      updateData.mediaUrl = await uploadTask.ref.getDownloadURL();
      updateData.mediaType = newFile.type.startsWith('video') ? 'video' : 'image';
      updateData.storagePath = filename;
    }

    await db.collection(COLLECTION).doc(productId).update(updateData);
    return updateData;
  }

  // ---------- Delete Product ----------
  async function deleteProduct(productId) {
    const doc = await db.collection(COLLECTION).doc(productId).get();
    if (doc.exists && doc.data().storagePath) {
      try {
        await storage.ref(doc.data().storagePath).delete();
      } catch (e) { /* ignore */ }
    }
    await db.collection(COLLECTION).doc(productId).delete();
  }

  // ---------- Get Seller Info ----------
  async function getSellerInfo(userId) {
    const snapshot = await db.collection('users').doc(userId).get();
    if (!snapshot.exists) {
      // Try querying by id field
      const q = await db.collection('users').where('id', '==', userId).get();
      if (q.empty) return null;
      return q.docs[0].data();
    }
    return snapshot.data();
  }

  // ---------- WhatsApp Link ----------
  function getWhatsAppLink(phone, productTitle, price) {
    const message = `Hi! I'm interested in buying *${productTitle}* (₹${price}) from SheMakers. Is it available?`;
    const cleanPhone = phone.replace(/\D/g, '');
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  }

  return {
    addProduct, getAllProducts, getSellerProducts,
    getProduct, updateProduct, deleteProduct,
    getSellerInfo, getWhatsAppLink, seedDemoProducts
  };
})();
