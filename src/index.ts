import express from 'express';
import { PrismaClient } from './generated/prisma'



const app = express();
const prisma = new PrismaClient();

app.use(express.json());



app.post('/identify', async (req, res) => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    res.status(400).json({ error: 'At least one of email or phoneNumber is required.' });
    return;
  }

  const conditions: any[] = [];
  if (email) conditions.push({ email });
  if (phoneNumber) conditions.push({ phoneNumber });

  const matchedContacts = await prisma.contact.findMany({
    where: {
      OR: conditions
    },
    orderBy: { createdAt: 'asc' }
  });

  let allRelatedContacts: typeof matchedContacts = [...matchedContacts];

  if (matchedContacts.length === 0) {
    const newPrimary = await prisma.contact.create({
      data: {
        email,
        phoneNumber,
        linkPrecedence: 'primary',
        linkedId: null
      }
    });

    res.json({
      contact: {
        primaryContatctId: newPrimary.id,
        emails: [email].filter(Boolean),
        phoneNumbers: [phoneNumber].filter(Boolean),
        secondaryContactIds: []
      }
    });
    return;
  }

  
  let primaryContact = matchedContacts[0];

  for (const contact of matchedContacts) {
    if (contact.id !== primaryContact.id && contact.linkPrecedence === 'primary') {
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          linkPrecedence: 'secondary',
          linkedId: primaryContact.id,
          updatedAt: new Date()
        }
      });
    }
  }

  const updatedContacts = await prisma.contact.findMany({
    where: {
      OR: [
        { id: primaryContact?.id },
        { linkedId: primaryContact?.id }
      ]
    },
    orderBy: { createdAt: 'asc' }
  });

  const finalEmails = [...new Set(updatedContacts.map(c => c.email).filter(Boolean))];
  const finalPhoneNumbers = [...new Set(updatedContacts.map(c => c.phoneNumber).filter(Boolean))];
  const finalSecondaryContactIds = updatedContacts.filter(c => c.linkPrecedence === 'secondary').map(c => c.id);
  const primaryContatctId = updatedContacts.find(c => c.linkPrecedence === 'primary')?.id;

  res.json({
    contact: {
      primaryContatctId,
      emails: finalEmails,
      phoneNumbers: finalPhoneNumbers,
      secondaryContactIds: finalSecondaryContactIds
    }
  });
});
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});