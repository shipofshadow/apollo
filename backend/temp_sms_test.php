<?php
require 'Engine/SmsService.php';
$data = [
    'fullName' => 'Test',
    'emailAddress' => 'test@example.com',
    'contactNumber' => '09171234567',
    'make' => 'Toyota',
    'model' => 'Corolla',
    'yearModel' => '2020',
    'plateNumber' => 'ABC123',
    'address' => '123 main st',
    'facebookName' => 'testfb',
    'productToPurchase' => 'Oil change',
    'appointmentDate' => '2026-07-22',
    'appointmentTime' => '10:00',
];
$s = new SmsService();
var_dump(method_exists($s, 'customerInquiryAdmin'));
var_dump(method_exists($s, 'customerInquiryCustomer'));
// do not actually send SMS during test if the API key is not set or enabled
// $s->customerInquiryAdmin($data);
